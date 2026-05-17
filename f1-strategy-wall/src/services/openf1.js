const BASE = "https://api.openf1.org/v1";
const SESSION_KEY = 9523;

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

  throw new Error("Rate limited by OpenF1");
}

export async function loadRaceData() {
  const drivers = await fetchJson(
    `${BASE}/drivers?session_key=${SESSION_KEY}`
  );

  await sleep(400);

  const positions = await fetchJson(
    `${BASE}/position?session_key=${SESSION_KEY}`
  );

  await sleep(400);

  const intervals = await fetchJson(
    `${BASE}/intervals?session_key=${SESSION_KEY}`
  );

  await sleep(400);

  const stints = await fetchJson(
    `${BASE}/stints?session_key=${SESSION_KEY}`
  );

  await sleep(400);

  const raceControl = await fetchJson(
    `${BASE}/race_control?session_key=${SESSION_KEY}`
  );

  const driverMap = {};
  drivers.forEach((d) => {
    driverMap[d.driver_number] = d;
  });

  const latestPositionMap = {};
  positions.forEach((p) => {
    latestPositionMap[p.driver_number] = p;
  });

  const latestIntervalMap = {};
  intervals.forEach((i) => {
    latestIntervalMap[i.driver_number] = i;
  });

  const latestStintMap = {};
  stints.forEach((s) => {
    latestStintMap[s.driver_number] = s;
  });

  const leaderboard = Object.keys(driverMap)
    .map((driverNumber) => {
      const driver = driverMap[driverNumber];
      const pos = latestPositionMap[driverNumber];
      const interval = latestIntervalMap[driverNumber];
      const stint = latestStintMap[driverNumber];

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
        compound: stint?.compound ?? "—",
        tyreAge: stint?.tyre_age_at_start ?? "—",
        stintNumber: stint?.stint_number ?? "—",
      };
    })
    .sort((a, b) => a.position - b.position);

  return {
    leaderboard,
    raceControl: raceControl.slice(-20).reverse(),
  };
}