import type { Festival, SimulationFrame } from "../../domain";
import {
  attendeeDescription,
  statusStyles,
  vendorDisplay,
} from "./presentation";

export function StatusLegend() {
  return (
    <ul className="status-legend" aria-label="Attendee status legend">
      {Object.entries(statusStyles).map(([key, style]) => (
        <li key={key}>
          <i style={{ background: style.color, opacity: style.opacity }} />
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
}: {
  festival: Festival;
  frame: SimulationFrame;
  inspectedId: string;
  onInspect: (id: string) => void;
}) {
  const selected =
    frame.attendees.find((item) => item.id === inspectedId) ??
    frame.attendees[0];
  return (
    <div className="frame-details">
      <h3>Vendor state · recorded frame</h3>
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
              </tr>
            </thead>
            <tbody>
              {frame.vendors.map((state) => {
                const value = vendorDisplay(state);
                return (
                  <tr key={state.vendorId}>
                    <th scope="row">
                      {festival.vendors.find((v) => v.id === state.vendorId)
                        ?.name ?? state.vendorId}
                    </th>
                    <td>{value.queue}</td>
                    <td>{value.inventory}</td>
                    <td>{value.sales}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No vendor states in this frame.</p>
      )}
      <h3>Inspect an attendee</h3>
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
    </div>
  );
}
