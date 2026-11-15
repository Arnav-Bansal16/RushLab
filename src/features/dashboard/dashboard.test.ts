import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import Dashboard from "./FinalResultsDashboard";
import { demoFestival } from "../../fixtures/demoFestival";
import { demoSimulationResult } from "../../fixtures/demoSimulationResult";
import {
  multiDestinationFestival,
  multiDestinationSimulationResult,
} from "../../fixtures/multiDestination";
import type { ActiveRun } from "../playback/run";
import { executeRun } from "../playback/run";
import {
  createFestivalDemo,
  festivalDemoSettings,
} from "../playback/vendorDemo";
import { initialPlayback, playbackReducer } from "../playback/controller";

function frozen<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(frozen);
  }
  return value;
}
const fixture = (): ActiveRun =>
  structuredClone({
    festivalSnapshot: multiDestinationFestival,
    settingsSnapshot: multiDestinationSimulationResult.settings,
    result: multiDestinationSimulationResult,
    warnings: [],
  });
const render = (run: ActiveRun | null, previous = false) =>
  renderToStaticMarkup(createElement(Dashboard, { run, previous }));

describe("canonical final dashboard", () => {
  it("exposes a labeled no-run state", () => {
    expect(render(null)).toContain("No successful run yet");
    expect(render(null)).toContain('aria-labelledby="final-results-heading"');
  });
  it("renders reviewed final totals independently from vendor rows and frames", () => {
    const run: ActiveRun = {
      festivalSnapshot: demoFestival,
      settingsSnapshot: demoSimulationResult.settings,
      result: structuredClone(demoSimulationResult),
      warnings: [],
    };
    run.result.vendorMetrics[0].revenue = 987;
    const html = render(run);
    expect(html).toContain("Modeled revenue (currency units)</dt><dd>12.00");
    expect(html).toContain("<td>987.00</td>");
    expect(html).toContain("<td>15</td>");
    expect(html).toContain("No stockout recorded");
    expect(html).toContain("Unavailable");
  });
  it("renders all canonical destination rows, names, transitions and units in supplied order", () => {
    const run = fixture();
    const html = render(run);
    for (const metric of run.result.destinationMetrics) {
      const entity = [
        ...run.festivalSnapshot.vendors,
        ...run.festivalSnapshot.stages,
        ...(run.festivalSnapshot.amenities ?? []),
      ].find((d) => d.id === metric.destinationId)!;
      expect(html).toContain(`<th scope="row">${entity.name}</th>`);
      expect(html).toContain(
        `<td>${metric.visits}</td><td>${metric.uniqueVisitors}</td><td>${metric.repeatVisits}</td><td>${metric.completedDwellSeconds}</td><td>${metric.truncatedDwellSeconds}</td>`,
      );
    }
    expect(html).toContain(
      '<th scope="row">Stage</th><td>Restroom</td><td>1</td>',
    );
    expect(html).toContain("person-seconds");
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('scope="col"');
  });
  it("distinguishes optional missed-sale absence, supplied zero, stockout zero and nonzero values", () => {
    const run = fixture();
    run.result.vendorMetrics[0].missedSales = { count: 0, value: 0 };
    run.result.vendorMetrics[0].stockoutTimeSeconds = 0;
    expect(render(run)).toContain("<td>0</td><td>0</td><td>0.00</td>");
    run.result.vendorMetrics[0].missedSales = { count: 13, value: 117 };
    expect(render(run)).toContain("<td>13</td><td>117.00</td>");
    delete run.result.vendorMetrics[0].missedSales;
    expect(render(run)).toContain("<td>Unavailable</td><td>Unavailable</td>");
  });
  it("renders real zero-demand results without frames, empty transitions and warnings", () => {
    const outcome = executeRun(createFestivalDemo(), {
      ...festivalDemoSettings,
      attendeeCount: 0,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw Error("run rejected");
    outcome.run.result.frames = [];
    outcome.run.warnings.push("Saved input warning");
    const html = render(outcome.run, true);
    expect(html).toContain("Purchases (count)</dt><dd>0");
    expect(html).toContain("currency units)</dt><dd>0.00");
    expect(html).toContain("No destination transitions recorded");
    expect(html).toContain("Saved input warning");
    expect(html).toContain("Previous successful result retained");
    expect(html).toContain("Unlimited");
    expect(html).toContain(
      "<td>0</td><td>0</td><td>0</td><td>0</td><td>0</td>",
    );
  });
  it("keeps frozen snapshots and final markup unchanged through all playback actions and draft edits", () => {
    const run = frozen(fixture());
    const before = JSON.stringify(run);
    const html = render(run);
    const draft = structuredClone(run.festivalSnapshot);
    draft.vendors[0].name = "Edited live name";
    let state = initialPlayback(run.result.frames);
    for (const action of [
      { type: "play" },
      { type: "advance", elapsedSeconds: 10 },
      { type: "pause" },
      { type: "scrub", timeSeconds: 0 },
      { type: "speed", speed: 4 },
      { type: "restart" },
      { type: "scrub", timeSeconds: 9999 },
      { type: "play" },
    ] as const) {
      state = playbackReducer(run.result.frames, state, action);
      expect(render(run)).toBe(html);
    }
    expect(html).not.toContain("Edited live name");
    expect(JSON.stringify(run)).toBe(before);
  });
  it("displays a real integrated run without deriving UI analytics", () => {
    const outcome = executeRun(createFestivalDemo(), {
      ...festivalDemoSettings,
      attendeeCount: 25,
    });
    if (!outcome.ok) throw Error(outcome.errors.join(" "));
    const run = frozen(outcome.run);
    const html = render(run);
    expect(html).toContain(
      `Purchases (count)</dt><dd>${run.result.totals.purchases}`,
    );
    expect(run.result.destinationMetrics.length).toBeGreaterThan(0);
    expect(html).toContain("Completed-run vendor results");
    expect(html).toContain("Completed-run destination activity");
  });
});
