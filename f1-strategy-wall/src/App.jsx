// src/App.jsx

import React, { useEffect, useState } from "react";
import { loadRaceData } from "./services/openf1";
import "./index.css";

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const result = await loadRaceData();
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading OpenF1 Strategy Wall...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>F1 Strategy Wall</h1>
          <p>OpenF1 Session 9523</p>
        </div>
      </div>

      <div className="layout">
        <div className="leaderboard">
          <table>
            <thead>
              <tr>
                <th>POS</th>
                <th>DRIVER</th>
                <th>TEAM</th>
                <th>GAP</th>
                <th>INT</th>
                <th>TYRE</th>
                <th>AGE</th>
                <th>STINT</th>
              </tr>
            </thead>

            <tbody>
              {data.leaderboard.map((driver) => (
                <tr key={driver.driverNumber}>
                  <td>{driver.position}</td>

                  <td>
                    <div className="driver-cell">
                      <img src={driver.headshot} alt={driver.name} />
                      <div>
                        <div className="driver-name">{driver.short}</div>
                        <div className="driver-full">{driver.name}</div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="team-cell">
                      <span
                        className="team-dot"
                        style={{
                          backgroundColor: `#${driver.teamColor}`,
                        }}
                      />
                      {driver.team}
                    </div>
                  </td>

                  <td>{driver.gap}</td>
                  <td>{driver.interval}</td>
                  <td>{driver.compound}</td>
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
            {data.raceControl.map((item, i) => (
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