// src/services/openf1.js

const BASE = "https://api.openf1.org/v1";
const SESSION_KEY = 9523;
const OUT_THRESHOLD_MS = 120000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);

    if (res.ok) {
      return res.json();
    }

    if (res.status === 429) {
      await sleep(1500 * (i + 1));
      continue;
    }

    throw new Error(`OpenF1 API error: ${res.status}`);
  }

  throw new Error("Rate limited");
}

function getTireImage(compound) {
  const c = String(compound || "").toUpperCase();

  if (c.includes("SOFT")) return "/assets/tires/soft.png";
  if (c.includes("MEDIUM")) return "/assets/tires/medium.png";
  if (c.includes("HARD")) return "/assets/tires/hard.png";
  if (c.includes("INTER")) return "/assets/tires/intermediate.png";
  if (c.includes("WET")) return "/assets/tires/wet.png";

  return "/assets/tires/unknown.png";
}

function formatLapTime(seconds) {
  if (typeof seconds !== "number") return "—";

  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3).padStart(6, "0");

  return `${mins}:${secs}`;
}

function parseInterval(value) {
  if (!value) return null;

  const parsed = parseFloat(String(value).replace("+", ""));
  return Number.isNaN(parsed) ? null : parsed;
}

function getSectorClass(value, best) {
  if (typeof value !== "number" || typeof best !== "number") {
    return "sector-neutral";
  }

  if (Math.abs(value - best) < 0.001) {
    return "sector-purple";
  }

  if (value <= best + 0.25) {
    return "sector-green";
  }

  return "sector-red";
}

export async function loadReplayData() {
  const drivers = await fetchJson(`${BASE}/drivers?session_key=${SESSION_KEY}`);
  await sleep(300);

  const positions = await fetchJson(`${BASE}/position?session_key=${SESSION_KEY}`);
  await sleep(300);

  const intervals = await fetchJson(`${BASE}/intervals?session_key=${SESSION_KEY}`);
  await sleep(300);

  const stints = await fetchJson(`${BASE}/stints?session_key=${SESSION_KEY}`);
  await sleep(300);

  const laps = await fetchJson(`${BASE}/laps?session_key=${SESSION_KEY}`);
  await sleep(300);

  const raceControl = await fetchJson(`${BASE}/race_control?session_key=${SESSION_KEY}`);

  return {
    drivers: Array.isArray(drivers) ? drivers : [],
    positions: Array.isArray(positions) ? positions : [],
    intervals: Array.isArray(intervals) ? intervals : [],
    stints: Array.isArray(stints) ? stints : [],
    laps: Array.isArray(laps) ? laps : [],
    raceControl: Array.isArray(raceControl) ? raceControl : [],
  };
}

function buildTrackState(raceControl, laps, currentTime) {
  const events = raceControl
    .filter((r) => new Date(r.date).getTime() <= currentTime)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const visibleLaps = laps.filter(
    (lap) => new Date(lap.date_start).getTime() <= currentTime
  );

  const lapNumbers = visibleLaps
    .map((lap) => lap.lap_number)
    .filter((n) => typeof n === "number");

  const allLapNumbers = laps
    .map((lap) => lap.lap_number)
    .filter((n) => typeof n === "number");

  const currentLap = lapNumbers.length ? Math.max(...lapNumbers) : 1;
  const totalLaps = allLapNumbers.length ? Math.max(...allLapNumbers) : 1;

  const yellowSectors = {};
  let redFlag = false;
  let yellowCount = 0;

  for (const event of events) {
    const flag = String(event.flag || "").toUpperCase();
    const sector = event.sector;

    if (flag === "RED") {
      redFlag = true;
      continue;
    }

    if (flag === "CLEAR") {
      if (sector) {
        delete yellowSectors[sector];
      } else {
        Object.keys(yellowSectors).forEach((k) => delete yellowSectors[k]);
        redFlag = false;
      }
      continue;
    }

    if (flag === "YELLOW" || flag === "DOUBLE YELLOW") {
      if (sector) {
        yellowSectors[sector] = true;
      }
      yellowCount++;
    }
  }

  let trackStatus = "🟢 TRACK CLEAR";

  if (redFlag) {
    trackStatus = "🔴 RED FLAG";
  } else if (Object.keys(yellowSectors).length) {
    const sectors = Object.keys(yellowSectors)
      .sort((a, b) => Number(a) - Number(b))
      .map((s) => `S${s}`)
      .join(" / ");

    trackStatus = `🟡 YELLOW - ${sectors}`;
  }

  return {
    currentLap,
    totalLaps,
    yellowCount,
    trackStatus,
    isRedFlag: redFlag,
  };
}

function getLatestLap(laps, driverNumber, currentTime) {
  const driverLaps = laps
    .filter(
      (lap) =>
        String(lap.driver_number) === String(driverNumber) &&
        new Date(lap.date_start).getTime() <= currentTime
    )
    .sort((a, b) => new Date(b.date_start) - new Date(a.date_start));

  return driverLaps[0] || null;
}

function getCurrentStint(stints, driverNumber, lapNumber) {
  return (
    stints.find((stint) => {
      if (String(stint.driver_number) !== String(driverNumber)) {
        return false;
      }

      const start = stint.lap_start ?? 1;
      const end = stint.lap_end ?? 999;

      return lapNumber >= start && lapNumber <= end;
    }) || null
  );
}

function getDriverStatus(laps, intervals, currentTime, driverNumber, trackState) {
  const driverIntervals = intervals
    .filter(
      (interval) =>
        String(interval.driver_number) === String(driverNumber) &&
        new Date(interval.date).getTime() <= currentTime
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const latestInterval = driverIntervals[0];

  if (!latestInterval) {
    return "OUT";
  }

  const age = currentTime - new Date(latestInterval.date).getTime();

  if (age > OUT_THRESHOLD_MS) {
    return "OUT";
  }

  if (trackState.isRedFlag) {
    return "IN PIT";
  }

  const latestLap = getLatestLap(laps, driverNumber, currentTime);

  if (latestLap?.is_pit_out_lap) {
    return "ON TRACK - OUT LAP";
  }

  return "ON TRACK";
}

function getGain(intervals, driverNumber, currentTime) {
  const driverIntervals = intervals
    .filter(
      (interval) =>
        String(interval.driver_number) === String(driverNumber) &&
        new Date(interval.date).getTime() <= currentTime &&
        interval.interval
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (driverIntervals.length < 2) {
    return {
      value: "—",
      className: "gain-neutral",
    };
  }

  const current = parseInterval(driverIntervals[0].interval);
  const previous = parseInterval(driverIntervals[1].interval);

  if (current == null || previous == null) {
    return {
      value: "—",
      className: "gain-neutral",
    };
  }

  const delta = previous - current;

  if (Math.abs(delta) < 0.01) {
    return {
      value: "0.000",
      className: "gain-neutral",
    };
  }

  if (delta > 0) {
    return {
      value: `-${delta.toFixed(3)}`,
      className: "gain-positive",
    };
  }

  return {
    value: `+${Math.abs(delta).toFixed(3)}`,
    className: "gain-negative",
  };
}

export function buildSnapshot(data, currentTime) {
  const trackState = buildTrackState(
    data.raceControl,
    data.laps,
    currentTime
  );

  const currentDriverLaps = data.drivers
    .map((driver) =>
      getLatestLap(data.laps, driver.driver_number, currentTime)
    )
    .filter(Boolean);

  const s1Values = currentDriverLaps
    .map((lap) => lap.duration_sector_1)
    .filter((v) => typeof v === "number");

  const s2Values = currentDriverLaps
    .map((lap) => lap.duration_sector_2)
    .filter((v) => typeof v === "number");

  const s3Values = currentDriverLaps
    .map((lap) => lap.duration_sector_3)
    .filter((v) => typeof v === "number");

  const bestS1 = s1Values.length ? Math.min(...s1Values) : null;
  const bestS2 = s2Values.length ? Math.min(...s2Values) : null;
  const bestS3 = s3Values.length ? Math.min(...s3Values) : null;

  const latestPositionMap = {};
  data.positions
    .filter((p) => new Date(p.date).getTime() <= currentTime)
    .forEach((p) => {
      latestPositionMap[p.driver_number] = p;
    });

  const latestIntervalMap = {};
  data.intervals
    .filter((i) => new Date(i.date).getTime() <= currentTime)
    .forEach((i) => {
      latestIntervalMap[i.driver_number] = i;
    });

  const leaderboard = data.drivers
    .map((driver) => {
      const driverNumber = driver.driver_number;
      const latestLap = getLatestLap(data.laps, driverNumber, currentTime);
      const lapNumber = latestLap?.lap_number ?? 1;
      const stint = getCurrentStint(data.stints, driverNumber, lapNumber);
      const compound = stint?.compound ?? "UNKNOWN";

      return {
        driverNumber,
        name: `${driver.first_name || ""} ${driver.last_name || ""}`.trim(),
        short: driver.name_acronym || driver.broadcast_name || "UNK",
        team: driver.team_name || "Unknown",
        teamColor: driver.team_colour || "666666",
        headshot: driver.headshot_url || "",
        position: latestPositionMap[driverNumber]?.position ?? 99,
        gap: latestIntervalMap[driverNumber]?.gap_to_leader ?? "—",
        interval: latestIntervalMap[driverNumber]?.interval ?? "—",
        tyreImage: getTireImage(compound),
        tyreAge:
          stint && latestLap
            ? (stint.tyre_age_at_start ?? 0) +
              (lapNumber - (stint.lap_start ?? 1))
            : "—",
        stintNumber: stint?.stint_number ?? "—",
        status: getDriverStatus(
          data.laps,
          data.intervals,
          currentTime,
          driverNumber,
          trackState
        ),
        gain: getGain(data.intervals, driverNumber, currentTime),
        lastLap: formatLapTime(latestLap?.lap_duration),

        s1:
          typeof latestLap?.duration_sector_1 === "number"
            ? latestLap.duration_sector_1.toFixed(3)
            : "—",

        s2:
          typeof latestLap?.duration_sector_2 === "number"
            ? latestLap.duration_sector_2.toFixed(3)
            : "—",

        s3:
          typeof latestLap?.duration_sector_3 === "number"
            ? latestLap.duration_sector_3.toFixed(3)
            : "—",

        s1Class: getSectorClass(latestLap?.duration_sector_1, bestS1),
        s2Class: getSectorClass(latestLap?.duration_sector_2, bestS2),
        s3Class: getSectorClass(latestLap?.duration_sector_3, bestS3),
      };
    })
    .sort((a, b) => a.position - b.position);

  const raceControl = data.raceControl
    .filter((r) => new Date(r.date).getTime() <= currentTime)
    .slice(-20)
    .reverse();

  return {
    leaderboard,
    raceControl,
    trackState,
  };
}