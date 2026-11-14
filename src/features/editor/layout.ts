import type { Festival, Point, Size, VendorCategory } from "@/domain";
import { clampVendorPosition, pathFootprint } from "./geometry";

export const componentKinds = [
  "gate",
  "exit",
  "vendor",
  "stage",
  "path",
  "obstacle",
  "seating",
  "restroom",
  "first_aid",
  "parking",
  "custom",
] as const;
export type ComponentKind = (typeof componentKinds)[number];
export const kindLabels: Record<ComponentKind, string> = {
  gate: "Entrance gate",
  exit: "Exit",
  vendor: "Vendor",
  stage: "Stage",
  path: "Walkway",
  obstacle: "Obstacle / barrier",
  seating: "Seating area",
  restroom: "Restrooms",
  first_aid: "First aid",
  parking: "Parking",
  custom: "Custom area",
};
export interface EditorElement {
  id: string;
  kind: ComponentKind;
  name: string;
  position: Point;
  size: Size;
  color: string;
  shape: "rectangle" | "circle";
}
/** Editor-only extension. Exits and annotations do not define simulation behavior. */
export interface LayoutDocument extends Festival {
  editor: {
    schemaVersion: 1;
    eventType: string;
    elements: EditorElement[];
    labels: Record<string, string>;
    colors: Record<string, string>;
  };
}
export interface LayoutItem {
  id: string;
  kind: ComponentKind;
  name: string;
  position: Point;
  size: Size;
  color: string;
  shape: "rectangle" | "circle";
}
export function createBlankLayout(): LayoutDocument {
  return {
    schemaVersion: 1,
    id: "event-layout",
    name: "Untitled event",
    boundsMeters: { width: 120, height: 80 },
    entrances: [],
    stages: [],
    vendors: [],
    paths: [],
    obstacles: [],
    editor: {
      schemaVersion: 1,
      eventType: "Custom event",
      elements: [],
      labels: {},
      colors: {},
    },
  };
}
export function fromFestival(festival: Festival): LayoutDocument {
  return {
    ...structuredClone(festival),
    editor: {
      schemaVersion: 1,
      eventType: "Custom event",
      elements: [],
      labels: {},
      colors: {},
    },
  };
}
function box(points: Point[]) {
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  return {
    position: { x, y },
    size: { width: Math.max(...xs) - x, height: Math.max(...ys) - y },
  };
}
export function layoutItems(doc: LayoutDocument): LayoutItem[] {
  return [
    ...doc.entrances.map((item) => ({
      ...item,
      kind: "gate" as const,
      size: { width: 0, height: 0 },
      color: "#247963",
      shape: "circle" as const,
    })),
    ...doc.stages.map((item) => ({
      ...item,
      kind: "stage" as const,
      color: "#293f3b",
      shape: "rectangle" as const,
    })),
    ...doc.vendors.map((item) => ({
      ...item,
      kind: "vendor" as const,
      color: "#dfaa70",
      shape: "rectangle" as const,
    })),
    ...doc.paths.map((item) => ({
      id: item.id,
      name: "Walkway",
      kind: "path" as const,
      ...pathFootprint(item),
      color: "#fffaf0",
      shape: "rectangle" as const,
    })),
    ...doc.obstacles.map((item) => ({
      id: item.id,
      name: "Obstacle",
      kind: "obstacle" as const,
      ...box(item.points),
      color: "#91a38b",
      shape: "rectangle" as const,
    })),
    ...doc.editor.elements,
  ].map((item) => ({
    ...item,
    name: doc.editor.labels[item.id] ?? item.name,
    color: doc.editor.colors[item.id] ?? item.color,
  }));
}
export interface NewComponent {
  kind: ComponentKind;
  name: string;
  width: number;
  height: number;
  color: string;
  shape: "rectangle" | "circle";
  category: VendorCategory;
  servers: number;
}
export function addComponent(
  doc: LayoutDocument,
  details: NewComponent,
): { document: LayoutDocument; id: string } {
  if (
    ![details.width, details.height].every(
      (value) => Number.isFinite(value) && value >= 0,
    ) ||
    (details.kind !== "gate" && (details.width <= 0 || details.height <= 0)) ||
    !Number.isSafeInteger(details.servers) ||
    details.servers < 1
  )
    throw new Error("Invalid component dimensions or service counters.");
  const used = new Set([doc.id, ...layoutItems(doc).map((item) => item.id)]);
  let index = 1;
  while (used.has(`${details.kind}-${index}`)) index++;
  const id = `${details.kind}-${index}`;
  const size = {
    width: Math.min(details.width, doc.boundsMeters.width),
    height: Math.min(details.height, doc.boundsMeters.height),
  };
  const position = clampVendorPosition(
    {
      x: doc.boundsMeters.width / 2 + (index - 1) * 3,
      y: doc.boundsMeters.height / 2 + (index - 1) * 3,
    },
    size,
    doc.boundsMeters,
  );
  const next = structuredClone(doc);
  const name = details.name.trim() || kindLabels[details.kind];
  next.editor.labels[id] = name;
  next.editor.colors[id] = details.color;
  switch (details.kind) {
    case "gate":
      next.entrances.push({ id, name, position, spawnWeight: 1 });
      break;
    case "vendor":
      next.vendors.push({
        id,
        name,
        position,
        size,
        category: details.category,
        servers: details.servers,
        popularity: 0.5,
        averagePrice: 12,
        serviceTimeSeconds: 75,
        inventory: null,
        queueLimit: null,
      });
      break;
    case "stage":
      next.stages.push({ id, name, position, size, attraction: 0.9 });
      break;
    case "path":
      next.paths.push({
        id,
        points: [
          { x: position.x, y: position.y + size.height / 2 },
          { x: position.x + size.width, y: position.y + size.height / 2 },
        ],
        widthMeters: size.height,
      });
      break;
    case "obstacle":
      next.obstacles.push({
        id,
        points: [
          position,
          { x: position.x + size.width, y: position.y },
          { x: position.x + size.width, y: position.y + size.height },
          { x: position.x, y: position.y + size.height },
        ],
      });
      break;
    default:
      next.editor.elements.push({
        id,
        kind: details.kind,
        name,
        position,
        size,
        color: details.color,
        shape: details.shape,
      });
  }
  return { document: next, id };
}
export function editComponent(
  doc: LayoutDocument,
  id: string,
  patch: Partial<
    Pick<LayoutItem, "name" | "position" | "size" | "color" | "shape">
  >,
): LayoutDocument {
  if (
    patch.position &&
    ![patch.position.x, patch.position.y].every(Number.isFinite)
  )
    return doc;
  if (
    patch.size &&
    ![patch.size.width, patch.size.height].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    return doc;
  const current = layoutItems(doc).find((item) => item.id === id);
  if (!current) return doc;
  const next = structuredClone(doc);
  const size = {
    width: Math.max(
      0,
      Math.min(patch.size?.width ?? current.size.width, doc.boundsMeters.width),
    ),
    height: Math.max(
      0,
      Math.min(
        patch.size?.height ?? current.size.height,
        doc.boundsMeters.height,
      ),
    ),
  };
  const position = clampVendorPosition(
    patch.position ?? current.position,
    size,
    doc.boundsMeters,
  );
  if (patch.name !== undefined) next.editor.labels[id] = patch.name;
  if (patch.color !== undefined) next.editor.colors[id] = patch.color;
  for (const item of [...next.entrances, ...next.stages, ...next.vendors])
    if (item.id === id) {
      item.position = position;
      if (patch.name !== undefined) item.name = patch.name;
      if ("size" in item) item.size = size;
    }
  const path = next.paths.find((item) => item.id === id);
  const obstacle = next.obstacles.find((item) => item.id === id);
  if (path) {
    const xScale = current.size.width ? size.width / current.size.width : 1;
    const yScale = current.size.height ? size.height / current.size.height : 1;
    const centerline = box(path.points);
    const thicknessScale =
      centerline.size.height === 0
        ? yScale
        : centerline.size.width === 0
          ? xScale
          : Math.min(xScale, yScale);
    path.points = path.points.map((p) => ({
      x: position.x + (p.x - current.position.x) * xScale,
      y: position.y + (p.y - current.position.y) * yScale,
    }));
    path.widthMeters *= thicknessScale;
  }
  if (obstacle) {
    obstacle.points = obstacle.points.map((p) => ({
      x:
        position.x +
        (current.size.width
          ? ((p.x - current.position.x) / current.size.width) * size.width
          : 0),
      y:
        position.y +
        (current.size.height
          ? ((p.y - current.position.y) / current.size.height) * size.height
          : 0),
    }));
  }
  const element = next.editor.elements.find((item) => item.id === id);
  if (element) Object.assign(element, patch, { position, size });
  return next;
}
export function removeComponent(
  doc: LayoutDocument,
  id: string,
): LayoutDocument {
  return {
    ...doc,
    entrances: doc.entrances.filter((item) => item.id !== id),
    stages: doc.stages.filter((item) => item.id !== id),
    vendors: doc.vendors.filter((item) => item.id !== id),
    paths: doc.paths.filter((item) => item.id !== id),
    obstacles: doc.obstacles.filter((item) => item.id !== id),
    editor: {
      ...doc.editor,
      elements: doc.editor.elements.filter((item) => item.id !== id),
      labels: Object.fromEntries(
        Object.entries(doc.editor.labels).filter(([key]) => key !== id),
      ),
      colors: Object.fromEntries(
        Object.entries(doc.editor.colors).filter(([key]) => key !== id),
      ),
    },
  };
}
export function resizeSite(doc: LayoutDocument, bounds: Size): LayoutDocument {
  if (
    ![bounds.width, bounds.height].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    return doc;
  let next = { ...doc, boundsMeters: bounds };
  for (const item of layoutItems(next)) next = editComponent(next, item.id, {});
  return next;
}
