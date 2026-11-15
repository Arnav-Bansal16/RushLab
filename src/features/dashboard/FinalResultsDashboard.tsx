import type { ReactNode } from "react";
import type { DestinationType, Festival, SimulationResult } from "../../domain";
import type { ActiveRun } from "../playback/run";
import ResolvedAssumptions from "../simulation-settings/ResolvedAssumptions";
import "./dashboard.css";

const number = (value: number | undefined) =>
  value === undefined
    ? "Unavailable"
    : value.toLocaleString("en-US", {
        maximumFractionDigits: 1,
        useGrouping: false,
      });
const money = (value: number | undefined) =>
  value === undefined
    ? "Unavailable"
    : value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
const labels: Record<DestinationType, string> = {
  vendor: "Vendor",
  stage: "Stage",
  restroom: "Restroom",
  seating: "Seating",
  first_aid: "First aid",
};

function ResultsTable({
  caption,
  headings,
  children,
}: {
  caption: string;
  headings: string[];
  children: ReactNode;
}) {
  return (
    <div
      className="final-table-scroll"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headings.map((label) => (
              <th scope="col" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function FinalSummary({
  result,
  missedSaleValue,
}: {
  result: SimulationResult;
  missedSaleValue?: number;
}) {
  return (
    <section aria-labelledby="final-summary">
      <h3 id="final-summary">Final run summary</h3>
      <dl className="final-summary">
        {[
          ["Purchases (count)", number(result.totals.purchases)],
          ["Modeled revenue (currency units)", money(result.totals.revenue)],
          ["Modeled sales lost (currency units)", money(missedSaleValue)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>
        Modeled sales lost represents missed-sale opportunities, not actual lost
        festival revenue: a guest may buy elsewhere. Unavailable means at least
        one vendor has no supplied missed-sale value.
      </p>
    </section>
  );
}

export function VendorResults({
  result,
  festival,
}: {
  result: SimulationResult;
  festival: Festival;
}) {
  return (
    <section aria-labelledby="final-vendors">
      <h3 id="final-vendors">Vendor performance</h3>
      <p>
        See which stalls made sales and where guests waited. Waits cover
        completed waits; missed sales count modeled opportunities.
      </p>
      {result.vendorMetrics.length > 0 && (
        <ResultsTable
          caption="Vendor highlights"
          headings={[
            "Vendor",
            "Purchases",
            "Modeled revenue (currency units)",
            "Average wait (seconds)",
            "Missed-sale attempts",
          ]}
        >
          {result.vendorMetrics.map((metric) => (
            <tr key={metric.vendorId}>
              <th scope="row">
                {festival.vendors.find((v) => v.id === metric.vendorId)?.name ??
                  metric.vendorId}
              </th>
              <td>{number(metric.purchases)}</td>
              <td>{money(metric.revenue)}</td>
              <td>{number(metric.averageWaitSeconds)}</td>
              <td>{number(metric.missedSales?.count)}</td>
            </tr>
          ))}
        </ResultsTable>
      )}
      <details>
        <summary>
          All vendor metrics · queues, capacity and missed-sale value
        </summary>
        <p>
          Vendor visits count admitted queue visits. Destination visits count
          visit starts.
        </p>
        {result.vendorMetrics.length ? (
          <ResultsTable
            caption="Completed-run vendor results"
            headings={[
              "Vendor",
              "Visits (count)",
              "Queue joins (count)",
              "Purchases (count)",
              "Modeled revenue (currency units)",
              "Average completed wait (seconds)",
              "Maximum waiting queue (count)",
              "Abandonments (count)",
              "Utilization (%)",
              "First stockout (simulation seconds)",
              "Modeled missed-sale attempts (count)",
              "Modeled missed-sale value (currency units)",
            ]}
          >
            {result.vendorMetrics.map((metric) => (
              <tr key={metric.vendorId}>
                <th scope="row">
                  {festival.vendors.find((v) => v.id === metric.vendorId)
                    ?.name ?? metric.vendorId}
                </th>
                {[
                  number(metric.visits),
                  number(metric.queueJoins),
                  number(metric.purchases),
                  money(metric.revenue),
                  number(metric.averageWaitSeconds),
                  number(metric.maximumQueueLength),
                  number(metric.abandonments),
                  metric.utilization === undefined
                    ? "Unavailable"
                    : `${(metric.utilization * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`,
                  metric.stockoutTimeSeconds === null
                    ? "No stockout recorded"
                    : number(metric.stockoutTimeSeconds),
                  number(metric.missedSales?.count),
                  money(metric.missedSales?.value),
                ].map((value, index) => (
                  <td key={index}>{value}</td>
                ))}
              </tr>
            ))}
          </ResultsTable>
        ) : (
          <p>No vendor results supplied.</p>
        )}
      </details>
      <p>
        Missed-sale counts represent attempts, not unique people. Values are
        modeled opportunities, not actual lost festival revenue; a guest may buy
        elsewhere. Missing optional values are unavailable, not measured zeroes.
      </p>
    </section>
  );
}

export function DestinationResults({
  result,
  festival,
}: {
  result: SimulationResult;
  festival: Festival;
}) {
  const destinations = [
    ...festival.vendors,
    ...festival.stages,
    ...(festival.amenities ?? []),
  ];
  return (
    <section aria-labelledby="final-destinations">
      <h3 id="final-destinations">Destination activity</h3>
      <p>
        Dwell is aggregate person-seconds across visits, not an average.
        Truncated dwell covers visits cut short at run end. Vendor visit
        duration includes its visit interval, including queue and service.
      </p>
      {result.destinationMetrics?.length ? (
        <ResultsTable
          caption="Completed-run destination activity"
          headings={[
            "Destination",
            "Type",
            "Visits (count)",
            "Unique visitors (count)",
            "Repeat visits (count)",
            "Completed dwell (person-seconds)",
            "Truncated dwell (person-seconds)",
          ]}
        >
          {result.destinationMetrics.map((metric) => (
            <tr key={metric.destinationId}>
              <th scope="row">
                {destinations.find((d) => d.id === metric.destinationId)
                  ?.name ?? metric.destinationId}
              </th>
              <td>{labels[metric.destinationType]}</td>
              {[
                metric.visits,
                metric.uniqueVisitors,
                metric.repeatVisits,
                metric.completedDwellSeconds,
                metric.truncatedDwellSeconds,
              ].map((value, index) => (
                <td key={index}>{number(value)}</td>
              ))}
            </tr>
          ))}
        </ResultsTable>
      ) : (
        <p>
          {result.destinationMetrics
            ? "No destination rows supplied."
            : "Destination activity unavailable."}
        </p>
      )}
    </section>
  );
}

export function DestinationTransitions({
  result,
}: {
  result: SimulationResult;
}) {
  return (
    <section aria-labelledby="final-transitions">
      <h3 id="final-transitions">Destination transitions</h3>
      <p>
        Consecutive destination visits per attendee, grouped by type. A
        transition does not imply a purchase.
      </p>
      {result.destinationTransitions?.length ? (
        <ResultsTable
          caption="Completed-run destination-type transitions"
          headings={[
            "From destination type",
            "To destination type",
            "Transitions (count)",
          ]}
        >
          {result.destinationTransitions.map((metric) => (
            <tr key={`${metric.fromType}:${metric.toType}`}>
              <th scope="row">{labels[metric.fromType]}</th>
              <td>{labels[metric.toType]}</td>
              <td>{number(metric.count)}</td>
            </tr>
          ))}
        </ResultsTable>
      ) : (
        <p>
          {result.destinationTransitions
            ? "No destination transitions recorded."
            : "Destination transitions unavailable."}
        </p>
      )}
    </section>
  );
}

/** Receives only the saved successful run. Future UI-03B composes its report through children. */
export default function FinalResultsDashboard({
  run,
  previous = false,
  children,
}: {
  run: ActiveRun | null;
  previous?: boolean;
  children?: ReactNode;
}) {
  if (!run)
    return (
      <section
        className="final-results"
        aria-labelledby="final-results-heading"
      >
        <h2 id="final-results-heading">Final results</h2>
        <p role="status">
          No successful run yet. Run a simulation to see completed results.
        </p>
      </section>
    );
  const { result, festivalSnapshot: festival } = run;
  return (
    <section className="final-results" aria-labelledby="final-results-heading">
      <header>
        <p className="eyebrow">COMPLETED RUN</p>
        <h2 id="final-results-heading">Final results · {festival.name}</h2>
        <p>
          Modeled estimates, not forecasts. These completed-run values stay
          fixed while playback plays, pauses, scrubs or replays.
        </p>
        <p>
          {result.settings.attendeeCount} attendees · requested duration{" "}
          {result.settings.durationSeconds} simulation seconds · seed{" "}
          {result.settings.seed}
        </p>
        {previous && (
          <p role="status">
            Previous successful result retained: the latest run attempt was
            rejected.
          </p>
        )}
      </header>
      {run.warnings.length > 0 && (
        <aside aria-label="Final result input warnings">
          <strong>Input warnings for this result</strong>
          <ul>
            {run.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </aside>
      )}
      <FinalSummary
        result={result}
        missedSaleValue={run.modeledMissedSaleValue}
      />
      <VendorResults result={result} festival={festival} />
      <details className="report-detail">
        <summary>Explore destination visits and movement</summary>
        <DestinationResults result={result} festival={festival} />
        <DestinationTransitions result={result} />
      </details>
      <details className="report-detail">
        <summary>Assumptions and model details</summary>
        <p>Exited attendees (count): {number(result.totals.exitedAttendees)}</p>
        <section aria-labelledby="final-assumptions">
          <h3 id="final-assumptions">Modeled assumptions and limitations</h3>
          <ResolvedAssumptions settings={result.settings} />
          <details>
            <summary>Destination assumptions saved with this layout</summary>
            <ul>
              {festival.vendors.map((v) => (
                <li key={v.id}>
                  {v.name}: price {money(v.averagePrice)} currency units;
                  service {v.serviceTimeSeconds} seconds; {v.servers} servers;
                  initial inventory{" "}
                  {v.inventory === null ? "Unlimited" : v.inventory}; waiting
                  capacity {v.queueLimit === null ? "Unlimited" : v.queueLimit}.
                </li>
              ))}
              {[...festival.stages, ...(festival.amenities ?? [])].map((d) => (
                <li key={d.id}>
                  {d.name}: dwell{" "}
                  {d.dwellDurationOverrideSeconds
                    ? `${d.dwellDurationOverrideSeconds.minimum}–${d.dwellDurationOverrideSeconds.maximum} seconds (location override)`
                    : "inherits saved run settings"}
                  .
                </li>
              ))}
            </ul>
          </details>
          <p>
            Queue frustration is a modeled state. Nonvendor amenities do not
            model service queues or congestion. This simulation does not
            establish scientifically validated walkway, collision, safety or
            crowd-flow bottlenecks.
          </p>
        </section>
      </details>
      {children}
    </section>
  );
}
