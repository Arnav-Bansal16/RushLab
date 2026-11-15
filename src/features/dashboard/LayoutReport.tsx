"use client";

import { useState, type ReactNode } from "react";
import { buildIssuesReport } from "../../analytics/recommendations";
import type {
  Festival,
  LayoutOptimization,
  IssueReport,
  NumericMetricComparison,
  NumericMetricValue,
  NumericMetricDelta,
  PercentageMetricDelta,
  ScenarioComparison,
  SeedEvaluation,
  IssueCategory,
  SimulationResult,
} from "../../domain";
import { totalMissedSaleValue } from "../../analytics/metrics/totalMissedSaleValue";
import { demoImprovementTargets } from "../../analytics/metrics/demoTargets";
import type { ActiveRun } from "../playback/run";

const label = (value: string) => value.replaceAll("_", " ");
const numeric = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 6 });
function entityName(festival: Festival, id: string) {
  return (
    [
      ...festival.vendors,
      ...festival.stages,
      ...festival.entrances,
      ...(festival.amenities ?? []),
    ].find((entity) => entity.id === id)?.name ?? id
  );
}
function Table({
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
            {headings.map((heading) => (
              <th key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function MetricValue({
  value,
  percentage = false,
  delta = false,
  precision = 6,
}: {
  value: NumericMetricValue | NumericMetricDelta | PercentageMetricDelta;
  percentage?: boolean;
  delta?: boolean;
  precision?: number;
}) {
  if (value.status !== "available")
    return (
      <span>
        {value.status === "not_applicable" ? "Not applicable" : "Unavailable"} (
        {label(value.reason)})
      </span>
    );
  return (
    <>
      {delta && value.value > 0 ? "+" : ""}
      {value.value.toLocaleString("en-US", {
        maximumFractionDigits: precision,
      })}
      {percentage ? "%" : ""}
    </>
  );
}
function unit(metric: string) {
  if (/revenue|Value/.test(metric)) return "modeled currency units";
  if (/Seconds/.test(metric))
    return /Dwell/.test(metric) ? "person-seconds" : "seconds";
  return metric === "utilization" ? "ratio" : "count";
}
const metricNames: Record<string, string> = {
  purchases: "Purchases",
  revenue: "Modeled revenue",
  abandonments: "Queue departures",
  exitedAttendees: "Guests exited",
  averageWaitSeconds: "Average completed wait",
  missedSaleCount: "Missed-sale attempts",
  missedSaleValue: "Modeled opportunity value",
};
function Metrics({
  caption,
  metrics,
  summary = false,
}: {
  caption: string;
  metrics: NumericMetricComparison[];
  summary?: boolean;
}) {
  return (
    <Table
      caption={caption}
      headings={
        summary
          ? ["Statistic", "Before", "After (tested)", "Change", "Change (%)"]
          : [
              "Metric / units",
              "Baseline",
              "Alternative",
              "Absolute delta",
              "Percentage delta",
            ]
      }
    >
      {metrics.map((metric) => (
        <tr key={metric.metric}>
          <th scope="row">
            {metricNames[metric.metric] ?? metric.metric} ({unit(metric.metric)}
            )
          </th>
          <td>
            <MetricValue value={metric.baseline} precision={summary ? 2 : 6} />
          </td>
          <td>
            <MetricValue
              value={metric.alternative}
              precision={summary ? 2 : 6}
            />
          </td>
          <td>
            <MetricValue
              value={metric.absoluteDelta}
              delta
              precision={summary ? 2 : 6}
            />
          </td>
          <td>
            <MetricValue
              value={metric.percentageDelta}
              delta
              percentage
              precision={summary ? 2 : 6}
            />
          </td>
        </tr>
      ))}
    </Table>
  );
}
export function ComparisonEvidence({
  comparison,
  festival,
}: {
  comparison: ScenarioComparison;
  festival: Festival;
}) {
  return (
    <section>
      <p>
        Comparison status: {comparison.compatibility.status}. Selected seed:{" "}
        {comparison.baseline.seed}. Values are for this seed, not three-seed
        averages.
      </p>
      {comparison.compatibility.errors.map((issue, index) => (
        <p role="alert" key={`error-${index}`}>
          Error: {issue.code} · {issue.path} · {issue.message}
        </p>
      ))}
      {comparison.compatibility.warnings.map((issue, index) => (
        <p key={`warning-${index}`}>
          Warning: {issue.code} · {issue.path} · {issue.message}
        </p>
      ))}
      {comparison.compatibility.status === "compatible" && (
        <>
          {comparison.totals && (
            <Metrics caption="Run totals" metrics={comparison.totals} />
          )}
          <details>
            <summary>Vendor comparisons</summary>
            {comparison.vendors?.map((row) => (
              <section key={row.vendorId}>
                <p>
                  {entityName(festival, row.vendorId)} ({row.vendorId}) ·
                  presence: {label(row.presence)}
                </p>
                <Metrics
                  caption={`Vendor ${row.vendorId}`}
                  metrics={row.metrics}
                />
              </section>
            ))}
          </details>
          <details>
            <summary>Destination comparisons</summary>
            {comparison.destinations?.map((row) => (
              <section key={row.destinationId}>
                <p>
                  {entityName(festival, row.destinationId)} ·{" "}
                  {row.destinationType} · presence: {label(row.presence)}
                </p>
                <Metrics
                  caption={`Destination ${row.destinationId}`}
                  metrics={row.metrics}
                />
              </section>
            ))}
          </details>
          <details>
            <summary>Destination transition comparisons</summary>
            {comparison.destinationTransitions?.map((row) => (
              <section key={`${row.fromType}-${row.toType}`}>
                <p>
                  {row.fromType} → {row.toType} · presence:{" "}
                  {label(row.presence)}
                </p>
                <Metrics
                  caption={`${row.fromType} to ${row.toType}`}
                  metrics={row.metrics}
                />
              </section>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
const issueTitles: Record<IssueCategory, string> = {
  wait: "Guests are waiting too long",
  queue: "Vendor queues are building up",
  abandonment: "Guests are leaving vendor queues",
  utilization: "Vendor service capacity is under pressure",
  stockout: "Vendors are running out of stock",
  frustration: "Queue departures are creating modeled frustration",
  missed_sales: "Vendors have modeled missed-sale opportunities",
  underuse: "Some locations are underused",
  overload: "Demand is concentrated at some locations",
  uneven_visits: "Visits are unevenly distributed",
  uneven_dwell: "Time spent at destinations is uneven",
  weak_transition: "Some destination-to-destination visits are uncommon",
};

export function Issues({ report }: { report: IssueReport }) {
  return (
    <section>
      <h3>Layout issues summary</h3>
      {report.findings.length === 0 && (
        <p>
          No supported findings. Missing evidence, if any, is listed separately
          below.
        </p>
      )}
      {report.findings.length > 0 && (
        <Table
          caption="Issues, locations and solutions"
          headings={["Issues", "Locations", "Solution to test"]}
        >
          {[
            ...new Set(
              report.findings.map((finding) => finding.suggestedAction),
            ),
          ].map((action, index) => {
            const findings = report.findings.filter(
              (finding) => finding.suggestedAction === action,
            );
            const categories = [
              ...new Set(findings.map((finding) => finding.category)),
            ];
            const names = [
              ...new Set(
                findings
                  .flatMap((finding) => finding.affectedEntityIds)
                  .map((id) => entityName(report.festival, id)),
              ),
            ];
            return (
              <tr key={action}>
                <th scope="row">
                  <ul>
                    {categories.map((category) => (
                      <li key={category}>{issueTitles[category]}</li>
                    ))}
                  </ul>
                </th>
                <td>{names.join(", ")}</td>
                <td>
                  <strong>Solution {index + 1}</strong>
                  <p>{action}</p>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
      {report.findings.length > 0 && (
        <p>
          Evaluate alternatives below to see which changes help in the model.
          These findings do not mean every issue can be fixed automatically.
        </p>
      )}
      <details className="issue-evidence">
        <summary>Detailed issue evidence and model limitations</summary>
        {report.findings.map((finding) => (
          <details key={finding.id}>
            <summary>
              {label(finding.severity)} · {label(finding.category)} ·{" "}
              {finding.affectedEntityIds
                .map((id) => `${entityName(report.festival, id)} (${id})`)
                .join(", ")}
            </summary>
            <p>Finding: {finding.id}</p>
            <p>{finding.rationale}</p>
            <p>Suggested action: {finding.suggestedAction}</p>
            <Table
              caption={`Evidence for ${finding.id}`}
              headings={[
                "Source / metric",
                "Entities",
                "Value / units",
                "Threshold rule",
                "Activity observed / required",
              ]}
            >
              {finding.evidence.map((evidence, index) => (
                <tr key={index}>
                  <th scope="row">
                    {evidence.source} · {evidence.metric}
                  </th>
                  <td>
                    {evidence.entityIds
                      .map((id) => entityName(report.festival, id))
                      .join(", ")}
                  </td>
                  <td>
                    {numeric(evidence.value)} {evidence.unit}
                  </td>
                  <td>
                    {evidence.comparison === "gte" ? "≥" : "≤"}{" "}
                    {numeric(evidence.threshold)} {evidence.unit}
                  </td>
                  <td>
                    {evidence.observedActivity} / {evidence.minimumActivity}
                  </td>
                </tr>
              ))}
            </Table>
            <p>Limitation: {finding.limitation}</p>
          </details>
        ))}
        {report.unavailableEvidence.map((evidence, index) => (
          <p key={index}>
            Unavailable evidence: {evidence.metric} ·{" "}
            {evidence.entityIds
              .map((id) => entityName(report.festival, id))
              .join(", ")}{" "}
            · {evidence.reason}
          </p>
        ))}
        {report.limitations.map((limitation, index) => (
          <p key={index}>Limitation: {limitation}</p>
        ))}
      </details>
    </section>
  );
}
function Objective({ pair }: { pair: SeedEvaluation }) {
  return (
    <>
      <h5>ANA-02 objective evidence</h5>
      {pair.status === "succeeded" ? (
        <p>Seed objective delta: {numeric(pair.objectiveDelta)}</p>
      ) : (
        <p>
          Evaluation failed at {pair.stage}: {pair.reasons.join("; ")}. No
          objective score supplied.
        </p>
      )}
      <Table
        caption={`Objective components · seed ${pair.seed}`}
        headings={[
          "Component",
          "Better direction",
          "Weight",
          "Normalization",
          "Baseline",
          "Alternative",
          "Contribution / omission",
        ]}
      >
        {pair.components.map((component) => (
          <tr key={component.metric}>
            <th scope="row">{label(component.metric)}</th>
            <td>{component.direction}</td>
            <td>{numeric(component.weight)}</td>
            <td>{numeric(component.normalization)}</td>
            <td>
              {component.available
                ? numeric(component.baseline)
                : "Unavailable"}
            </td>
            <td>
              {component.available
                ? numeric(component.alternative)
                : "Unavailable"}
            </td>
            <td>
              {component.available
                ? numeric(component.contribution)
                : component.reason}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
export function ImprovementSummary({ output }: { output: LayoutOptimization }) {
  const candidate = output.generation.candidates.find(
    (item) => item.id === output.ranking.bestTestedId,
  );
  const evaluation = output.ranking.evaluations.find(
    (item) => item.candidateId === candidate?.id,
  );
  const pair = evaluation?.seeds[0];
  const comparison = pair?.comparison;
  const wait = comparison?.vendors?.find((row) =>
    candidate?.changes.some((change) => change.vendorId === row.vendorId),
  );
  const waitMetric = wait?.metrics.find(
    (metric) => metric.metric === "averageWaitSeconds",
  );
  const purchases = comparison?.totals?.find(
    (metric) => metric.metric === "purchases",
  );
  const revenue = comparison?.totals?.find(
    (metric) => metric.metric === "revenue",
  );
  const money = (value: number | undefined) =>
    value === undefined
      ? "Unavailable"
      : value.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  return (
    <section
      className="improvement-summary"
      aria-label="Tested results summary"
    >
      <h3>Before and after</h3>
      {!candidate ||
      !pair ||
      comparison?.compatibility.status !== "compatible" ? (
        <p>No compatible alternative results available.</p>
      ) : (
        <>
          <p>
            Modeled estimates · seed {pair.seed}.{" "}
            {candidate.id === "higher-service-capacity"
              ? "Higher service capacity at all vendors (4×, capped at 100 servers each). Capacity costs are not modeled"
              : candidate.changes
                  .map(
                    (change) =>
                      `${entityName(candidate.festival, change.vendorId)}: ${change.kind === "set_servers" ? `${change.before} → ${change.after} servers` : "proposed move"}`,
                  )
                  .join("; ")}
            .
          </p>
          {!output.ranking.improvingId && <p>No overall improvement found.</p>}
          <Table
            caption="Before and after results"
            headings={["Statistic", "Before", "After"]}
          >
            <tr>
              <th scope="row">Purchases</th>
              <td>
                {purchases ? (
                  <MetricValue value={purchases.baseline} precision={0} />
                ) : (
                  "Unavailable"
                )}
              </td>
              <td>
                {purchases ? (
                  <MetricValue value={purchases.alternative} precision={0} />
                ) : (
                  "Unavailable"
                )}
              </td>
            </tr>
            <tr>
              <th scope="row">Revenue (currency units)</th>
              <td>
                {revenue?.baseline.status === "available"
                  ? money(revenue.baseline.value)
                  : "Unavailable"}
              </td>
              <td>
                {revenue?.alternative.status === "available"
                  ? money(revenue.alternative.value)
                  : "Unavailable"}
              </td>
            </tr>
            <tr>
              <th scope="row">Modeled sales lost (currency units)</th>
              <td>
                {money(
                  pair.baseline
                    ? totalMissedSaleValue(pair.baseline.vendorMetrics)
                    : undefined,
                )}
              </td>
              <td>
                {money(
                  pair.alternative
                    ? totalMissedSaleValue(pair.alternative.vendorMetrics)
                    : undefined,
                )}
              </td>
            </tr>
            <tr>
              <th scope="row">
                Queue wait ·{" "}
                {wait
                  ? entityName(candidate.festival, wait.vendorId)
                  : "affected vendor"}{" "}
                (seconds)
              </th>
              <td>
                {waitMetric ? (
                  <MetricValue value={waitMetric.baseline} precision={2} />
                ) : (
                  "Unavailable"
                )}
              </td>
              <td>
                {waitMetric ? (
                  <MetricValue value={waitMetric.alternative} precision={2} />
                ) : (
                  "Unavailable"
                )}
              </td>
            </tr>
          </Table>
          {waitMetric && (
            <p>
              Average completed queue wait change:{" "}
              <MetricValue
                value={waitMetric.absoluteDelta}
                delta
                precision={2}
              />{" "}
              seconds.{" "}
              {waitMetric.absoluteDelta.status === "available" &&
                (waitMetric.absoluteDelta.value < 0
                  ? "Less waiting."
                  : waitMetric.absoluteDelta.value > 0
                    ? "More waiting."
                    : "No change.")}
            </p>
          )}
          <p>
            Sales lost means modeled opportunities, not actual lost revenue.
          </p>
        </>
      )}
    </section>
  );
}

export function DemoBeforeAfter({ result }: { result: SimulationResult }) {
  const rows = demoImprovementTargets(result);
  const format = (value: number | undefined, money: boolean) =>
    value === undefined
      ? "Unavailable"
      : value.toLocaleString("en-US", {
          minimumFractionDigits: money ? 2 : 0,
          maximumFractionDigits: 2,
        });
  return (
    <section
      className="improvement-summary"
      aria-label="Illustrative before and after"
    >
      <h3>Before and after</h3>
      <p>Illustrative 20% improvement target — not simulated after-results.</p>
      <Table
        caption="Demo improvement targets"
        headings={[
          "Statistic",
          "Before (simulated)",
          "After (illustrative target)",
        ]}
      >
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{format(row.before, row.money)}</td>
            <td>{format(row.after, row.money)}</td>
          </tr>
        ))}
      </Table>
    </section>
  );
}
export function OptimizationEvidence({
  output,
  summary,
}: {
  output: LayoutOptimization;
  summary?: ReactNode;
}) {
  return (
    <section>
      {summary ?? <ImprovementSummary output={output} />}
      <details>
        <summary>Candidate ranking, tradeoffs and full evidence</summary>
        <h3>Best-tested candidate and ranking</h3>
        <p>
          Generation: {label(output.generation.outcome)}. Ranking:{" "}
          {label(output.ranking.outcome)}.
        </p>
        <p>
          Tested seeds: {output.seeds.join(", ")}. Best-tested:{" "}
          {output.ranking.bestTestedId ?? "None"}. Objective improvement:{" "}
          {output.ranking.improvingId ?? "None reported"}.
        </p>
        <p>
          Eligible order:{" "}
          {output.ranking.orderedEligibleIds.join(" → ") || "None"}.
        </p>
        {output.ranking.tieGroups.map((group, index) => (
          <p key={index}>Tied candidates: {group.join(", ")}</p>
        ))}
        <p>
          Best-tested means best within this bounded candidate and seed set,
          never globally optimal. Scores may be zero or negative; worsening
          metrics remain visible. Capacity cost is not modeled. The three-seed
          aggregate is not a confidence interval.
        </p>
        <p>
          Generation attempts: {output.generation.attempts} /{" "}
          {output.generation.attemptLimit}.
        </p>
        {output.generation.reasons.map((reason, index) => (
          <p key={index}>{reason}</p>
        ))}
        <details>
          <summary>Rejected actions and ranking limitations</summary>
          {output.generation.rejectedActions.map((action, index) => (
            <p key={index}>
              {action.actionId}: {action.reason} · {action.detail}
            </p>
          ))}
          {output.ranking.limitations.map((limitation, index) => (
            <p key={index}>{limitation}</p>
          ))}
        </details>
        {output.generation.candidates.map((candidate) => {
          const evaluation = output.ranking.evaluations.find(
            (value) => value.candidateId === candidate.id,
          );
          return (
            <details key={candidate.id}>
              <summary>
                {candidate.id === output.ranking.bestTestedId
                  ? "Best-tested · "
                  : "Candidate · "}
                {candidate.id} ·{" "}
                {evaluation?.eligible ? "Eligible" : "Ineligible / unevaluated"}
              </summary>
              <p>
                Tested seeds:{" "}
                {evaluation?.seeds.map((pair) => pair.seed).join(", ") ??
                  "None"}
                .
              </p>
              {evaluation?.failureReasons.map((reason, index) => (
                <p key={index}>Rejection: {reason}</p>
              ))}
              <p>
                Source findings: {candidate.sourceFindingIds.join(", ")}. Source
                actions: {candidate.sourceActionIds.join(", ")}.
              </p>
              <p>{candidate.rationale}</p>
              <p>
                Compatibility by seed:{" "}
                {evaluation?.seeds
                  .map(
                    (pair) =>
                      `${pair.seed}: ${pair.comparison?.compatibility.status ?? "comparison unavailable"}`,
                  )
                  .join("; ")}
                .
              </p>
              {evaluation?.seeds.flatMap((pair) =>
                [
                  ...(pair.comparison?.compatibility.errors ?? []),
                  ...(pair.comparison?.compatibility.warnings ?? []),
                ].map((issue, index) => (
                  <p key={`${pair.seed}-${index}`}>
                    Seed {pair.seed}: {issue.code} · {issue.path} ·{" "}
                    {issue.message}
                  </p>
                )),
              )}
              <p>
                Modeled tradeoffs use the supplied objective; individual metrics
                can worsen. Nonvendor destinations have no service queues; visit
                patterns do not establish physical congestion.
              </p>
              <h4>Exact proposed changes</h4>
              <ul>
                {candidate.changes.map((change, index) => (
                  <li key={index}>
                    {entityName(candidate.festival, change.vendorId)} (
                    {change.vendorId}):{" "}
                    {change.kind === "move"
                      ? `position (${change.before.x}, ${change.before.y}) → (${change.after.x}, ${change.after.y}) meters`
                      : `servers ${change.before} → ${change.after}`}
                  </li>
                ))}
              </ul>
              {evaluation?.eligible && (
                <p>
                  ANA-02 aggregate objective delta:{" "}
                  {numeric(evaluation.aggregateObjectiveDelta)} (higher is
                  better).
                </p>
              )}
              {evaluation?.seeds.map((pair) => (
                <details key={pair.seed}>
                  <summary>
                    Inspect seed {pair.seed} · {pair.status}
                  </summary>
                  {pair.status === "failed" &&
                    pair.comparison?.compatibility.status ===
                      "incompatible" && (
                      <p>
                        Evaluation failed at {pair.stage}:{" "}
                        {pair.reasons.join("; ")}. No objective score supplied.
                      </p>
                    )}
                  {pair.comparison?.compatibility.status !== "incompatible" && (
                    <Objective pair={pair} />
                  )}
                  {pair.comparison ? (
                    <ComparisonEvidence
                      comparison={pair.comparison}
                      festival={candidate.festival}
                    />
                  ) : (
                    <p>
                      Comparison unavailable.{" "}
                      {pair.status === "failed" &&
                        `${pair.stage}: ${pair.reasons.join("; ")}`}
                    </p>
                  )}
                </details>
              ))}
            </details>
          );
        })}
      </details>
    </section>
  );
}
export default function LayoutReport({
  run,
  output = null,
  error = "",
  demo = false,
}: {
  run: ActiveRun;
  output?: LayoutOptimization | null;
  error?: string;
  demo?: boolean;
}) {
  const [issues] = useState(() => buildIssuesReport(run.result));
  return (
    <section
      className="layout-report"
      aria-label="Layout issues and candidate evaluation"
    >
      <Issues report={output?.issues ?? issues} />
      {demo ? (
        <DemoBeforeAfter result={run.result} />
      ) : output ? (
        <OptimizationEvidence output={output} />
      ) : (
        <section className="improvement-summary">
          <h3>Before and after</h3>
          <p>{error || "No alternative results available for this run."}</p>
        </section>
      )}
    </section>
  );
}
