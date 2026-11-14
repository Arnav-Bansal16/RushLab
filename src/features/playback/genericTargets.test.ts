import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  multiDestinationFestival,
  multiDestinationSimulationResult,
} from "../../fixtures/multiDestination";
import { attendeeDescription, statusStyles } from "./presentation";
import { FrameDetails } from "./FrameDetails";
import type { AttendeeStatus, SimulationResult } from "../../domain";

it("renders reviewed generic destinations and all statuses without mutating frames", () => {
  const festival = structuredClone(multiDestinationFestival);
  const result: SimulationResult = structuredClone(
    multiDestinationSimulationResult,
  );
  const before = JSON.stringify(result);
  for (const frame of result.frames) {
    expect(() =>
      renderToStaticMarkup(
        createElement(FrameDetails, {
          festival,
          frame,
          inspectedId: "",
          onInspect: () => {},
        }),
      ),
    ).not.toThrow();
  }
  const attendee = result.frames.flatMap((f) => f.attendees)[0];
  for (const status of Object.keys(statusStyles) as AttendeeStatus[])
    expect(
      attendeeDescription(
        {
          ...attendee,
          status,
          target: null,
          targetVendorId: festival.vendors[0].id,
        },
        festival,
      ),
    ).toContain("No destination");
  for (const destinationType of [
    "vendor",
    "stage",
    "restroom",
    "seating",
    "first_aid",
  ] as const)
    expect(
      attendeeDescription(
        {
          ...attendee,
          status: "dwelling",
          target: { destinationType, destinationId: "absent" },
        },
        festival,
      ),
    ).toContain("Dwelling · absent");
  expect(JSON.stringify(result)).toBe(before);
});
