import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AttendeeStatus, SimulationFrame, SimulationResult } from "../../domain";
import { demoFestival } from "../../fixtures/demoFestival";
import { demoSimulationResult } from "../../fixtures/demoSimulationResult";
import { fitViewport } from "../editor/geometry";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("react-konva", () => ({
  Shape: (props: {
    fill: string;
    opacity: number;
    x: number;
    y: number;
    name: string;
  }) =>
    createElement("path", {
      fill: props.fill,
      opacity: props.opacity,
      "data-person": props.name,
      transform: `translate(${props.x} ${props.y})`,
    }),
}));
import PlaybackView, { PlaybackControls, RunMessages } from "./PlaybackView";
import { AttendeeMarks } from "./PlaybackCanvas";
import { FrameDetails, StatusLegend } from "./FrameDetails";
import { statusStyles } from "./presentation";
import PlaybackWorkspace from "./PlaybackWorkspace";
import { createBlankLayout } from "../editor/layout";

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

describe("playback rendering", () => {
  it("renders the shared fixture without mutating a frozen result", () => {
    const result = freeze(structuredClone(demoSimulationResult));
    const before = JSON.stringify(result);
    const html = renderToStaticMarkup(
      createElement(PlaybackView, { festival: demoFestival, result }),
    );
    expect(html).toContain("Event timeline");
    expect(html).toContain("160");
    expect(html).toContain("requested duration 180");
    expect(JSON.stringify(result)).toBe(before);
  });
  it("renders a no-run empty state, empty-result state, and accessible labeled controls", () => {
    const empty = renderToStaticMarkup(
      createElement(PlaybackWorkspace, { layout: createBlankLayout() }),
    );
    expect(empty).toContain("No simulation has run yet");
    expect(empty).toContain("price- and budget-sensitive vendor choices");
    expect(empty).not.toContain("planned for a future update");
    expect(empty).toMatch(/modeled\s+estimates, not forecasts/);
    expect(empty).toContain('role="status"');
    const noFrames = renderToStaticMarkup(
      createElement(PlaybackView, {
        festival: demoFestival,
        result: { ...demoSimulationResult, frames: [] },
      }),
    );
    expect(noFrames).toContain("no recorded frames");
    expect(noFrames).toContain("disabled");
    const controls = renderToStaticMarkup(
      createElement(PlaybackControls, {
        time: 0,
        first: 0,
        last: 160,
        playing: false,
        speed: 1,
        disabled: false,
        onAction: () => {},
      }),
    );
    for (const label of ["Play", "Restart", "Playback speed", "Event timeline"])
      expect(controls).toContain(label);
    expect(controls).toContain('type="range"');
    expect(controls).toContain('aria-valuetext="0.0 simulation seconds"');
    expect(
      renderToStaticMarkup(
        createElement(PlaybackControls, {
          time: 10,
          first: 0,
          last: 160,
          playing: true,
          speed: 2,
          disabled: false,
          onAction: () => {},
        }),
      ),
    ).toContain("Pause");
  });
  it("renders all statuses using supplied positions including exited identities and null targets", () => {
    const statuses = Object.keys(statusStyles) as AttendeeStatus[];
    const frame: SimulationFrame = {
      timeSeconds: 3,
      vendors: [],
      attendees: statuses.map((status, index) => ({
        id: `a-${index}`,
        position: { x: 10 + index, y: 20 },
        status,
        targetVendorId: null,
      })),
    };
    const before = structuredClone(frame);
    const circles = renderToStaticMarkup(
      createElement(
        "svg",
        null,
        createElement(AttendeeMarks, {
          frame,
          transform: fitViewport(demoFestival.boundsMeters, {
            width: 800,
            height: 500,
          }),
        }),
      ),
    );
    expect(circles.match(/data-person="attendee-person"/g)).toHaveLength(
      statuses.length,
    );
    for (const style of Object.values(statusStyles))
      expect(circles).toContain(style.color);
    for (const person of frame.attendees) {
      const detail = renderToStaticMarkup(
        createElement(FrameDetails, {
          festival: demoFestival,
          frame,
          inspectedId: person.id,
          onInspect: () => {},
        }),
      );
      expect(detail).toContain("No destination");
      expect(detail).toContain(statusStyles[person.status].label);
    }
    expect(renderToStaticMarkup(createElement(StatusLegend))).toContain(
      "Exited (faded)",
    );
    expect(frame).toEqual(before);
  });
  it("displays frame queue, unlimited/zero inventory, and completed purchase counts verbatim", () => {
    const frame: SimulationFrame = {
      timeSeconds: 10,
      attendees: [],
      vendors: [
        {
          vendorId: "vendor-tacos",
          queueLength: 7,
          inventoryRemaining: 0,
          cumulativeSales: 19,
        },
        {
          vendorId: "unknown",
          queueLength: 0,
          inventoryRemaining: null,
          cumulativeSales: 0,
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(FrameDetails, {
        festival: demoFestival,
        frame,
        inspectedId: "",
        onInspect: () => {},
      }),
    );
    expect(html).toContain("<td>7</td>");
    expect(html).toContain("Out of stock");
    expect(html).toContain("<td>19</td>");
    expect(html).toContain("Unlimited");
    expect(html).toContain("not revenue");
    expect(html).toContain("No attendees have spawned");
  });
  it("keeps validation messages and warnings visible and accessible", () => {
    const html = renderToStaticMarkup(
      createElement(RunMessages, {
        errors: ["Gate required"],
        warnings: ["Exit annotations are ignored"],
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Gate required");
    expect(html).toContain("Exit annotations are ignored");
    expect(
      renderToStaticMarkup(
        createElement(PlaybackView, {
          festival: demoFestival,
          result: demoSimulationResult,
          warnings: ["Keep this warning"],
        }),
      ),
    ).toContain("Keep this warning");
  });
});

it("updates vendor values and their timestamp from consecutive playback frames", () => {
  const base = {
    vendorId: "vendor-tacos",
    queueLength: 2,
    inventoryRemaining: 10,
    cumulativeSales: 0,
  };
  const first: SimulationFrame = {
    timeSeconds: 10,
    attendees: [],
    vendors: [base],
  };
  const next: SimulationFrame = {
    timeSeconds: 20,
    attendees: [],
    vendors: [
      { ...base, queueLength: 5, inventoryRemaining: 7, cumulativeSales: 3 },
    ],
  };
  const render = (frame: SimulationFrame, playing: boolean) =>
    renderToStaticMarkup(
      createElement(FrameDetails, {
        festival: demoFestival,
        frame,
        playing,
        inspectedId: "",
        onInspect: () => {},
      }),
    );
  expect(render(first, true)).toContain("<td>2</td><td>10</td><td>0</td>");
  const updated = render(next, true);
  expect(updated).toContain("<td>5</td><td>7</td><td>3</td>");
  expect(updated).toContain("0:20");
  expect(updated).toContain("Live playback");
  expect(render(next, false)).toContain("Paused");
  expect(first.vendors[0]).toEqual(base);
});

it("shows final engine revenue unchanged by the initial playback frame", () => {
  const result: SimulationResult = structuredClone(demoSimulationResult);
  result.vendorMetrics[0].revenue = 1234.56;
  result.frames[0].vendors[0].cumulativeSales = 0;
  const html = renderToStaticMarkup(
    createElement(PlaybackView, { festival: demoFestival, result }),
  );
  expect(html).toContain("1,234.56");
  expect(html).toContain("Final stall revenue");
  expect(html).toContain("not profit or a forecast");
  expect(result.frames[0].vendors[0].cumulativeSales).toBe(0);
});

it("shows full queues, supplied missed-sale values and the reason for each frustrated guest", () => {
  const result: SimulationResult = structuredClone(demoSimulationResult);
  const vendor = result.vendorMetrics[0];
  vendor.missedSales = { count: 1, value: 17 };
  result.events.push({
    type: "missed_sale",
    attendeeId: "angry-guest",
    vendorId: vendor.vendorId,
    timeSeconds: 5,
    reason: "wait_too_long",
    missedSaleValue: 17,
  });
  const html = renderToStaticMarkup(
    createElement(PlaybackView, { festival: demoFestival, result }),
  );
  expect(html).toContain("17.00");
  expect(html).toContain("angry-guest");
  expect(html).toContain("Wait too long");
  const frustration = {
    vendorId: vendor.vendorId,
    timeSeconds: 5,
    reason: "wait_too_long" as const,
    missedSaleValue: 17,
  };
  const frame: SimulationFrame = {
    timeSeconds: 6,
    attendees: [
      {
        id: "angry-guest",
        status: "walking",
        position: { x: 10, y: 10 },
        targetVendorId: null,
        target: null,
        queueFrustration: frustration,
      },
    ],
    vendors: [
      {
        vendorId: vendor.vendorId,
        queueLength: 8,
        queueFull: true,
        inventoryRemaining: null,
        cumulativeSales: 0,
      },
    ],
  };
  const details = renderToStaticMarkup(
    createElement(FrameDetails, {
      festival: demoFestival,
      frame,
      inspectedId: "angry-guest",
      onInspect: () => {},
    }),
  );
  expect(details).toContain("Queue full");
  expect(details).toContain("Frustrated");
  expect(details).toContain("wait too long");
  const marks = renderToStaticMarkup(
    createElement(
      "svg",
      null,
      createElement(AttendeeMarks, {
        frame,
        transform: fitViewport(demoFestival.boundsMeters, {
          width: 800,
          height: 500,
        }),
      }),
    ),
  );
  expect(marks).toContain("#e12828");
});
