// src/App.jsx

import React, { useEffect, useMemo, useState } from "react";
import { buildSnapshot, loadReplayData } from "./services/openf1";
import "./index.css";

function formatTime(ms) {
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

  useEffect(() => {
    async function init() {
      const data = await loadReplayData();

      const timestamps = data.positions.map((p) =>
        new Date(p.date).getTime()
      );

      const minTime = Math.min(...timestamps);

      setRawData({
        ...data,
        minTime,
        maxTime: Math.max(...timestamps),
      });

      setCurrentTime(minTime);
    }

    init();
  }, []);

  useEffect(() => {
    if (!playing || !rawData) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= rawData.maxTime) {
          setPlaying(false);
          return rawData.maxTime;
        }

        return prev + 60000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [playing, rawData]);

  const snapshot = useMemo(() => {
    if (!rawData || !currentTime) return null;
    return buildSnapshot(rawData, currentTime);
  }, [rawData, currentTime]);

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
            {formatTime(currentTime - rawData.minTime)}
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
                <th>GAP</th>
                <th>INT</th>
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
                      <img src={driver.headshot} alt={driver.name} />
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

                  <td>{driver.gap}</td>
                  <td>{driver.interval}</td>

                  <td>
                    <div className="tire-cell">
                      <img
                        src={driver.tyreImage}
                        alt={driver.compound}
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
                <div className="race-category">{item.category}</div>
                <div className="race-message">{item.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}