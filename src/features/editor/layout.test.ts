import { describe, expect, it } from "vitest";
import { demoFestival } from "../../fixtures/demoFestival";
import {
  addComponent,
  componentKinds,
  createBlankLayout,
  editComponent,
  fromFestival,
  layoutItems,
  removeComponent,
  resizeSite,
  type NewComponent,
} from "./layout";

const details: NewComponent = {
  kind: "gate",
  name: "Entry",
  width: 12,
  height: 8,
  color: "#247963",
  shape: "rectangle",
  category: "food",
  servers: 2,
};

describe("flexible venue layout", () => {
  it("starts with a truly blank canvas and keeps the shared example intact", () => {
    expect(layoutItems(createBlankLayout())).toEqual([]);
    expect(createBlankLayout().paths).toEqual([]);
    const before = structuredClone(demoFestival);
    const doc = fromFestival(demoFestival);
    const removed = removeComponent(doc, "path-main");
    expect(removed.paths).toEqual([]);
    expect(doc.paths).toHaveLength(1);
    expect(demoFestival).toEqual(before);
  });
  it("adds repeated gates, exit markers, and every component kind with unique IDs", () => {
    let doc = createBlankLayout();
    for (const kind of [...componentKinds, "gate", "exit", "vendor"] as const)
      doc = addComponent(doc, { ...details, kind, name: kind }).document;
    expect(doc.entrances).toHaveLength(2);
    expect(
      doc.editor.elements.filter((item) => item.kind === "exit"),
    ).toHaveLength(2);
    expect(doc.vendors).toHaveLength(2);
    const items = layoutItems(doc);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
    // Exits are intentionally annotations, not entrances with a disguised role.
    expect(doc.entrances.every((item) => item.id.startsWith("gate-"))).toBe(
      true,
    );
  });
  it("moves/resizes/renames annotations and removes them without affecting other components", () => {
    const first = addComponent(createBlankLayout(), {
      ...details,
      kind: "exit",
      name: "East Exit",
    });
    const second = addComponent(first.document, {
      ...details,
      kind: "custom",
      name: "VIP Lounge",
    });
    const edited = editComponent(second.document, second.id, {
      position: { x: 999, y: -10 },
      size: { width: 30, height: 20 },
      name: "Guest Lounge",
      color: "#abcdef",
      shape: "circle",
    });
    expect(
      layoutItems(edited).find((item) => item.id === second.id),
    ).toMatchObject({
      name: "Guest Lounge",
      position: { x: 90, y: 0 },
      size: { width: 30, height: 20 },
      color: "#abcdef",
      shape: "circle",
    });
    expect(removeComponent(edited, first.id).editor.elements).toHaveLength(1);
    expect(second.document.editor.elements[1].name).toBe("VIP Lounge");
  });
  it("keeps all component footprints within a resized site", () => {
    let doc = createBlankLayout();
    for (const kind of componentKinds)
      doc = addComponent(doc, {
        ...details,
        kind,
        width: 24,
        height: 12,
      }).document;
    const resized = resizeSite(doc, { width: 20, height: 10 });
    for (const item of layoutItems(resized)) {
      expect(item.position.x).toBeGreaterThanOrEqual(0);
      expect(item.position.y).toBeGreaterThanOrEqual(0);
      expect(item.position.x + item.size.width).toBeLessThanOrEqual(20);
      expect(item.position.y + item.size.height).toBeLessThanOrEqual(10);
    }
    expect(doc.boundsMeters).toEqual({ width: 120, height: 80 });
  });
  it("moves and changes the thickness of an optional walkway", () => {
    const added = addComponent(createBlankLayout(), {
      ...details,
      kind: "path",
      width: 20,
      height: 4,
    });
    const moved = editComponent(added.document, added.id, {
      position: { x: 15, y: 10 },
      size: { width: 30, height: 6 },
    });
    expect(moved.paths[0].points).toEqual([
      { x: 15, y: 13 },
      { x: 45, y: 13 },
    ]);
    expect(moved.paths[0].widthMeters).toBe(6);
    expect(layoutItems(moved)[0]).toMatchObject({
      position: { x: 15, y: 10 },
      size: { width: 30, height: 6 },
    });
  });
});

describe("integration geometry regressions", () => {
  it("moves vertical and diagonal shared paths without flattening them", () => {
    const doc = createBlankLayout();
    doc.paths = [
      {
        id: "vertical",
        points: [
          { x: 20, y: 10 },
          { x: 20, y: 40 },
        ],
        widthMeters: 4,
      },
      {
        id: "diagonal",
        points: [
          { x: 40, y: 20 },
          { x: 60, y: 40 },
        ],
        widthMeters: 4,
      },
    ];
    const moved = editComponent(doc, "vertical", {
      position: { x: 50, y: 30 },
    });
    expect(moved.paths[0].points).toEqual([
      { x: 52, y: 30 },
      { x: 52, y: 60 },
    ]);
    expect(moved.paths[0].widthMeters).toBe(4);
    const diagonal = editComponent(moved, "diagonal", {
      position: { x: 10, y: 10 },
    });
    expect(diagonal.paths[1].points).toEqual([
      { x: 12, y: 12 },
      { x: 32, y: 32 },
    ]);
    const resized = resizeSite(diagonal, { width: 30, height: 20 });
    for (const item of layoutItems(resized)) {
      expect(item.position.x).toBeGreaterThanOrEqual(0);
      expect(item.position.y).toBeGreaterThanOrEqual(0);
      expect(item.position.x + item.size.width).toBeLessThanOrEqual(30.000001);
      expect(item.position.y + item.size.height).toBeLessThanOrEqual(20.000001);
    }
  });
  it("rejects nonfinite public editor actions before JSON could turn values into null", () => {
    const doc = fromFestival(demoFestival);
    expect(
      editComponent(doc, "vendor-tacos", { position: { x: Infinity, y: 1 } }),
    ).toBe(doc);
    expect(
      editComponent(doc, "vendor-tacos", { size: { width: NaN, height: 1 } }),
    ).toBe(doc);
    expect(resizeSite(doc, { width: NaN, height: 80 })).toBe(doc);
    expect(() => addComponent(doc, { ...details, width: Infinity })).toThrow();
  });
});
