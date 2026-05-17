// src/services/openf1.js

const BASE = "https://api.openf1.org/v1";
const SESSION_KEY = 9523;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);

    if (res.ok) return res.json();

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

export async function loadReplayData() {
  const drivers = await fetchJson(`${BASE}/drivers?session_key=${SESSION_KEY}`);
  await sleep(300);

  const positions = await fetchJson(`${BASE}/position?session_key=${SESSION_KEY}`);
  await sleep(300);

  const intervals = await fetchJson(`${BASE}/intervals?session_key=${SESSION_KEY}`);
  await sleep(300);

  const stints = await fetchJson(`${BASE}/stints?session_key=${SESSION_KEY}`);
  await sleep(300);

  const raceControl = await fetchJson(`${BASE}/race_control?session_key=${SESSION_KEY}`);

  return {
    drivers,
    positions,
    intervals,
    stints,
    raceControl,
  };
}

export function buildSnapshot(data, currentTime) {
  const driverMap = {};
  data.drivers.forEach((d) => {
    driverMap[d.driver_number] = d;
  });

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

  const latestStintMap = {};
  data.stints.forEach((s) => {
    latestStintMap[s.driver_number] = s;
  });

  const leaderboard = Object.keys(driverMap)
    .map((driverNumber) => {
      const driver = driverMap[driverNumber];
      const pos = latestPositionMap[driverNumber];
      const interval = latestIntervalMap[driverNumber];
      const stint = latestStintMap[driverNumber];
      const compound = stint?.compound ?? "UNKNOWN";

      return {
        driverNumber,
        name: `${driver.first_name} ${driver.last_name}`,
        short: driver.name_acronym,
        team: driver.team_name,
        teamColor: driver.team_colour,
        headshot: driver.headshot_url,
        position: pos?.position ?? 99,
        gap: interval?.gap_to_leader ?? "—",
        interval: interval?.interval ?? "—",
        compound,
        tyreImage: getTireImage(compound),
        tyreAge: stint?.tyre_age_at_start ?? "—",
        stintNumber: stint?.stint_number ?? "—",
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
  };
}