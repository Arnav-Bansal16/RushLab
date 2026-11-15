import type { Festival, Point } from "../../domain";
import { clampToBounds } from "../movement";
import type { RandomStream } from "../random";

export function createTravelRoute(
  festival: Festival,
  from: Point,
  destination: Point,
  movement: Pick<RandomStream, "integer">,
  roamingWaypoints: readonly Point[] = [],
): Point[] {
  const pathPoints = festival.paths
    .flatMap(({ points }) => points)
    .map((point) => clampToBounds(point, festival));
  const pathPoint =
    pathPoints.length > 0
      ? pathPoints[movement.integer(0, pathPoints.length - 1)]
      : undefined;
  return [
    ...roamingWaypoints.map((point) => clampToBounds(point, festival)),
    ...(pathPoint && (pathPoint.x !== from.x || pathPoint.y !== from.y)
      ? [pathPoint]
      : []),
    clampToBounds(destination, festival),
  ];
}
