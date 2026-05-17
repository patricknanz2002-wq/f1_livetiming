// src/App.jsx

import React, { useEffect, useMemo, useState } from "react";
import { buildSnapshot, loadReplayData } from "./services/openf1";
import "./index.css";

function formatReplayTime(ms) {
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function App() {
  const [rawData, setRawData] = useState(null);
  const [currentTime, setCurrentTime] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const data = await loadReplayData();

        if (!data.positions.length) {
          throw new Error("No position data available");
        }

        const timestamps = data.positions
          .map((p) => new Date(p.date).getTime())
          .filter((t) => Number.isFinite(t));

        if (!timestamps.length) {
          throw new Error("Invalid timestamps");
        }

        const minTime = Math.min(...timestamps);
        const maxTime = Math.max(...timestamps);

        setRawData({
          ...data,
          minTime,
          maxTime,
        });

        setCurrentTime(minTime);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load replay");
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (!playing || !rawData) return;

    const timer = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= rawData.maxTime) {
          setPlaying(false);
          return rawData.maxTime;
        }

        return prev + 60000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [playing, rawData]);

  const snapshot = useMemo(() => {
    if (!rawData || !currentTime) return null;

    try {
      return buildSnapshot(rawData, currentTime);
    } catch (err) {
      console.error(err);
      setError(err.message || "Snapshot failed");
      return null;
    }
  }, [rawData, currentTime]);

  if (error) {
    return <div className="loading">ERROR: {error}</div>;
  }

  if (!snapshot || !rawData) {
    return <div className="loading">Loading Replay...</div>;
  }

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>F1 Strategy Wall Replay</h1>
          <p>Session 9523</p>
        </div>

        <div className="controls">
          <button onClick={() => setPlaying(true)}>PLAY</button>
          <button onClick={() => setPlaying(false)}>PAUSE</button>

          <input
            type="range"
            min={rawData.minTime}
            max={rawData.maxTime}
            value={currentTime}
            onChange={(e) => setCurrentTime(Number(e.target.value))}
          />

          <div className="time">
            {formatReplayTime(currentTime - rawData.minTime)}
          </div>
        </div>
      </div>

      <div className="track-panel">
        <div className="track-card">
          <div className="track-label">LAP</div>
          <div className="track-value">
            {snapshot.trackState.currentLap} / {snapshot.trackState.totalLaps}
          </div>
        </div>

        <div className="track-card">
          <div className="track-label">TRACK STATUS</div>
          <div className="track-status">
            {snapshot.trackState.trackStatus}
          </div>
        </div>

        <div className="track-card">
          <div className="track-label">YELLOW PHASES</div>
          <div className="track-value">
            {snapshot.trackState.yellowCount}
          </div>
        </div>
      </div>

      <div className="layout">
        <div className="leaderboard">
          <table>
            <thead>
              <tr>
                <th>POS</th>
                <th>DRIVER</th>
                <th>STATUS</th>
                <th>GAP</th>
                <th>INT</th>
                <th>GAIN</th>
                <th>S1</th>
                <th>S2</th>
                <th>S3</th>
                <th>LAST LAP</th>
                <th>TYRE</th>
                <th>AGE</th>
                <th>STINT</th>
              </tr>
            </thead>

            <tbody>
              {snapshot.leaderboard.map((driver) => (
                <tr key={driver.driverNumber}>
                  <td>{driver.position}</td>

                  <td>
                    <div className="driver-cell">
                      {driver.headshot ? (
                        <img src={driver.headshot} alt={driver.name} />
                      ) : (
                        <div className="driver-fallback">
                          {driver.short}
                        </div>
                      )}

                      <div>
                        <div className="driver-name">{driver.short}</div>
                        <div className="driver-full">{driver.name}</div>

                        <div className="driver-team">
                          <span
                            className="team-dot"
                            style={{
                              backgroundColor: `#${driver.teamColor}`,
                            }}
                          />
                          {driver.team}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span
                      className={`status-badge ${driver.status
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {driver.status}
                    </span>
                  </td>

                  <td>{driver.gap}</td>
                  <td>{driver.interval}</td>

                  <td className={`gain ${driver.gain.className}`}>
                    {driver.gain.value}
                  </td>

                  <td className={`sector-cell ${driver.s1Class}`}>
                    {driver.s1}
                  </td>

                  <td className={`sector-cell ${driver.s2Class}`}>
                    {driver.s2}
                  </td>

                  <td className={`sector-cell ${driver.s3Class}`}>
                    {driver.s3}
                  </td>

                  <td className="last-lap">{driver.lastLap}</td>

                  <td>
                    <div className="tire-cell">
                      <img
                        src={driver.tyreImage}
                        alt="Tyre"
                        className="tire-image"
                      />
                    </div>
                  </td>

                  <td>{driver.tyreAge}</td>
                  <td>{driver.stintNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sidebar">
          <h2>Race Control</h2>

          <div className="race-feed">
            {snapshot.raceControl.map((item, i) => (
              <div key={i} className="race-item">
                <div className="race-category">
                  {item.category || "RACE CONTROL"}
                </div>

                <div className="race-message">
                  {item.message || "No message"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}