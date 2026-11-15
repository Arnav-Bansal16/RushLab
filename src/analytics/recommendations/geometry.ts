import type { Festival, Point } from "../../domain";
import type { RejectedCandidateAction } from "../../domain";
type Rect = { position: Point; size: { width: number; height: number } };
const corners = (r: Rect): Point[] => [
  r.position,
  { x: r.position.x + r.size.width, y: r.position.y },
  { x: r.position.x + r.size.width, y: r.position.y + r.size.height },
  { x: r.position.x, y: r.position.y + r.size.height },
];
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const on = (p: Point, a: Point, b: Point) =>
  cross(a, b, p) === 0 &&
  p.x >= Math.min(a.x, b.x) &&
  p.x <= Math.max(a.x, b.x) &&
  p.y >= Math.min(a.y, b.y) &&
  p.y <= Math.max(a.y, b.y);
function intersects(a: Point, b: Point, c: Point, d: Point) {
  return (
    (cross(a, b, c) * cross(a, b, d) < 0 &&
      cross(c, d, a) * cross(c, d, b) < 0) ||
    on(a, c, d) ||
    on(b, c, d) ||
    on(c, a, b) ||
    on(d, a, b)
  );
}
function inside(p: Point, poly: Point[]) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (on(p, a, b)) return true;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}
/** Full rectangles in meters; touching obstacles is rejected, touching entity edges is legal. */
export function validateCandidateGeometry(
  festival: Festival,
): RejectedCandidateAction["reason"] | null {
  if (
    ![festival.boundsMeters.width, festival.boundsMeters.height].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    return "out_of_bounds";
  const entities = [
    ...festival.vendors,
    ...festival.stages,
    ...(festival.amenities ?? []),
  ];
  for (const v of festival.vendors) {
    const { x, y } = v.position,
      { width, height } = v.size;
    if (
      ![x, y, width, height].every(Number.isFinite) ||
      width <= 0 ||
      height <= 0 ||
      x < 0 ||
      y < 0 ||
      x + width > festival.boundsMeters.width ||
      y + height > festival.boundsMeters.height
    )
      return "out_of_bounds";
    for (const other of entities) {
      if (other === v) continue;
      if (
        x < other.position.x + other.size.width &&
        x + width > other.position.x &&
        y < other.position.y + other.size.height &&
        y + height > other.position.y
      )
        return "entity_overlap";
    }
    if (
      festival.entrances.some(
        (e) =>
          e.position.x >= x &&
          e.position.x <= x + width &&
          e.position.y >= y &&
          e.position.y <= y + height,
      )
    )
      return "entity_overlap";
    const rect = corners(v);
    for (const obstacle of festival.obstacles) {
      const poly = obstacle.points;
      // Malformed polygons cannot establish a legal placement.
      if (
        poly.length < 3 ||
        poly.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
      )
        return "obstacle_overlap";
      if (
        rect.some((p) => inside(p, poly)) ||
        poly.some((p) => inside(p, rect))
      )
        return "obstacle_overlap";
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < poly.length; j++)
          if (
            intersects(
              rect[i],
              rect[(i + 1) % 4],
              poly[j],
              poly[(j + 1) % poly.length],
            )
          )
            return "obstacle_overlap";
    }
  }
  return null;
}
