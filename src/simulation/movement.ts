import type { Festival, Point } from "../domain";
import type { RandomStream } from "./random";

export function clampToBounds(point: Point, festival: Festival): Point {
  return {
    x: Math.min(festival.boundsMeters.width, Math.max(0, point.x)),
    y: Math.min(festival.boundsMeters.height, Math.max(0, point.y)),
  };
}

export function createRoute(
  festival: Festival,
  entrance: Point,
  destination: Point,
  movement: RandomStream,
): Point[] {
  const pathPoints = festival.paths
    .flatMap(({ points }) => points)
    .map((point) => clampToBounds(point, festival));
  const route = pathPoints.length
    ? [pathPoints[movement.integer(0, pathPoints.length - 1)]]
    : [];
  return [
    ...route.filter(
      (point): point is Point =>
        point !== undefined &&
        (point.x !== entrance.x || point.y !== entrance.y),
    ),
    clampToBounds(destination, festival),
    clampToBounds(entrance, festival),
  ];
}

export function moveToward(
  position: Point,
  target: Point,
  maximumDistance: number,
): { position: Point; arrived: boolean } {
  const deltaX = target.x - position.x;
  const deltaY = target.y - position.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= maximumDistance || distance === 0) {
    return { position: { ...target }, arrived: true };
  }
  const ratio = maximumDistance / distance;
  return {
    position: {
      x: position.x + deltaX * ratio,
      y: position.y + deltaY * ratio,
    },
    arrived: false,
  };
}
