import { formatTime } from "./controller";
import type { Festival, SimulationFrame } from "../../domain";
import {
  attendeeDescription,
  statusStyles,
  betweenStopsStyle,
  angryStyle,
  vendorDisplay,
} from "./presentation";

export function StatusLegend() {
  return (
    <ul className="status-legend" aria-label="Attendee status legend">
      {Object.entries({
        walking: betweenStopsStyle,
        queued: statusStyles.queued,
        leaving: statusStyles.leaving,
        exited: statusStyles.exited,
        angry: angryStyle,
      }).map(([key, style]) => (
        <li key={key}>
          <svg
            width="10"
            height="15"
            viewBox="-4 -7 8 14"
            aria-hidden="true"
            style={{ color: style.color, opacity: style.opacity }}
          >
            <circle cx="0" cy="-4" r="1.8" fill="currentColor" />
            <path
              d="M-1.6 -1.5 H1.6 L3 2 L1.8 2.5 L1.2 .5 V3 L2 6 H.3 L0 3 L-.3 6 H-2 L-1.2 3 V.5 L-1.8 2.5 L-3 2 Z"
              fill="currentColor"
            />
          </svg>
          {style.label}
          {key === "exited" ? " (faded)" : ""}
        </li>
      ))}
    </ul>
  );
}
export function FrameDetails({
  festival,
  frame,
  inspectedId,
  onInspect,
  playing = false,
}: {
  festival: Festival;
  frame: SimulationFrame;
  inspectedId: string;
  onInspect: (id: string) => void;
  playing?: boolean;
}) {
  const selected =
    frame.attendees.find((item) => item.id === inspectedId) ??
    frame.attendees[0];
  return (
    <div className="frame-details">
      <div className="vendor-live-heading">
        <h3>What is happening at each vendor</h3>
        <span
          className={
            playing ? "vendor-live-badge is-playing" : "vendor-live-badge"
          }
          role="status"
        >
          {playing ? "Live playback" : "Paused"}
        </span>
      </div>
      <p className="vendor-frame-update">
        Showing vendor activity at {formatTime(frame.timeSeconds)}. Values
        follow the map as playback runs or you move the timeline.
      </p>
      <p>
        Queue counts include waiting attendees only. Completed purchases are a
        count, not revenue.
      </p>
      {frame.vendors.length ? (
        <div className="vendor-table-wrap">
          <table>
            <caption className="sr-only">
              Vendor values directly from the selected frame
            </caption>
            <thead>
              <tr>
                <th scope="col">Vendor</th>
                <th scope="col">Waiting</th>
                <th scope="col">Inventory remaining</th>
                <th scope="col">Completed purchases</th>
                <th scope="col">Average price (display currency units)</th>
              </tr>
            </thead>
            <tbody>
              {frame.vendors.map((state) => {
                const value = vendorDisplay(state);
                return (
                  <tr key={state.vendorId} data-vendor-id={state.vendorId}>
                    <th scope="row">
                      {festival.vendors.find((v) => v.id === state.vendorId)
                        ?.name ?? state.vendorId}
                    </th>
                    <td>
                      {value.queue}
                      {state.queueFull && <strong> · Queue full</strong>}
                    </td>
                    <td>
                      {value.inventory}
                      {state.inventoryRemaining === 0 && (
                        <span className="stockout-label">Out of stock</span>
                      )}
                    </td>
                    <td>{value.sales}</td>
                    <td>
                      {festival.vendors.find((v) => v.id === state.vendorId)
                        ?.averagePrice ?? "Unknown"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No vendor states in this frame.</p>
      )}
      <details className="attendee-details">
        <summary>Follow an individual guest (optional)</summary>
        {selected ? (
          <>
            <label htmlFor="playback-attendee">
              Attendee in the recorded frame
            </label>
            <select
              id="playback-attendee"
              value={selected.id}
              onChange={(event) => onInspect(event.target.value)}
            >
              {frame.attendees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id}
                </option>
              ))}
            </select>
            <p>{attendeeDescription(selected, festival)}</p>
          </>
        ) : (
          <p>No attendees have spawned in this recorded frame.</p>
        )}
      </details>
    </div>
  );
}
