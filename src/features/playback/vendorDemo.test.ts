import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createVendorDemo, vendorDemoSettings } from "./vendorDemo";
import { executeRun } from "./run";
import { attendeeDescription } from "./presentation";
import { createBlankLayout } from "../editor/layout";
import PlaybackWorkspace from "./PlaybackWorkspace";

describe("organizer-friendly vendor example", () => {
  it("runs eight named vendors with 300 real guests and keeps source data isolated", () => {
    const editor = createBlankLayout(),
      before = structuredClone(editor);
    const demo = createVendorDemo(),
      initial = structuredClone(demo);
    expect(demo.vendors).toHaveLength(8);
    expect(demo.entrances).toHaveLength(2);
    const run = executeRun(demo, vendorDemoSettings);
    if (!run.ok) throw new Error(run.errors.join(" "));
    expect(run.run.result.attendeeProfiles).toHaveLength(300);
    const visited = new Set(
      run.run.result.frames.flatMap((frame) =>
        frame.attendees.flatMap((person) =>
          person.targetVendorId ? [person.targetVendorId] : [],
        ),
      ),
    );
    expect(visited.size).toBe(8);
    expect(run.run.result.frames.at(-1)?.vendors).toHaveLength(8);
    expect(demo).toEqual(initial);
    expect(editor).toEqual(before);
    demo.vendors[0].name = "Changed";
    expect(createVendorDemo().vendors[0].name).toBe("Taco Kitchen");
  });
  it("describes guests using status and destinations without coordinate jargon", () => {
    const text = attendeeDescription(
      {
        id: "guest-1",
        status: "walking",
        position: { x: 12.34, y: 56.78 },
        targetVendorId: "market-vendor-1",
      },
      createVendorDemo(),
    );
    expect(text).toContain("Walking");
    expect(text).toContain("Taco Kitchen");
    expect(text).not.toContain("12.3");
    expect(text).not.toContain("56.8");
  });
  it("keeps advanced inputs closed and provides a one-click example", () => {
    const html = renderToStaticMarkup(
      createElement(PlaybackWorkspace, { layout: createBlankLayout() }),
    );
    expect(html).toContain("Try the 8-vendor demo");
    expect(html).toContain("Guests (up to 300)");
    expect(html).toContain("Preview length (minutes)");
    expect(html).toContain('<details class="advanced-run-settings">');
    expect(html).not.toContain('<details class="advanced-run-settings" open');
  });
});
