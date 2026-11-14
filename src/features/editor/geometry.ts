import type { Festival, PathSegment, Point, Size, Vendor } from "@/domain";

export interface Viewport {
  scale: number;
  offset: Point;
}
export function fitViewport(
  bounds: Size,
  viewport: Size,
  padding = 32,
): Viewport {
  const scale = Math.max(
    0.001,
    Math.min(
      (viewport.width - padding * 2) / bounds.width,
      (viewport.height - padding * 2) / bounds.height,
    ),
  );
  return {
    scale,
    offset: {
      x: (viewport.width - bounds.width * scale) / 2,
      y: (viewport.height - bounds.height * scale) / 2,
    },
  };
}
export function metersToPixels(point: Point, transform: Viewport): Point {
  return {
    x: point.x * transform.scale + transform.offset.x,
    y: point.y * transform.scale + transform.offset.y,
  };
}
export function pixelsToMeters(point: Point, transform: Viewport): Point {
  return {
    x: (point.x - transform.offset.x) / transform.scale,
    y: (point.y - transform.offset.y) / transform.scale,
  };
}
export function clampVendorPosition(
  position: Point,
  size: Size,
  bounds: Size,
): Point {
  return {
    x: Math.max(
      0,
      Math.min(position.x, Math.max(0, bounds.width - size.width)),
    ),
    y: Math.max(
      0,
      Math.min(position.y, Math.max(0, bounds.height - size.height)),
    ),
  };
}
export function updateVendor(
  festival: Festival,
  id: string,
  patch: Partial<Pick<Vendor, "position" | "name" | "servers">>,
): Festival {
  return {
    ...festival,
    vendors: festival.vendors.map((vendor) =>
      vendor.id === id
        ? {
            ...vendor,
            ...patch,
            position: clampVendorPosition(
              patch.position ?? vendor.position,
              vendor.size,
              festival.boundsMeters,
            ),
          }
        : vendor,
    ),
  };
}

/** Move a map entity without mutating the shared Festival draft. */
export function moveEntity(
  festival: Festival,
  id: string,
  position: Point,
): Festival {
  return {
    ...festival,
    vendors: festival.vendors.map((item) =>
      item.id === id
        ? {
            ...item,
            position: clampVendorPosition(
              position,
              item.size,
              festival.boundsMeters,
            ),
          }
        : item,
    ),
    stages: festival.stages.map((item) =>
      item.id === id
        ? {
            ...item,
            position: clampVendorPosition(
              position,
              item.size,
              festival.boundsMeters,
            ),
          }
        : item,
    ),
    entrances: festival.entrances.map((item) =>
      item.id === id
        ? {
            ...item,
            position: clampVendorPosition(
              position,
              { width: 0, height: 0 },
              festival.boundsMeters,
            ),
          }
        : item,
    ),
  };
}

export function addVendor(
  festival: Festival,
  details: Pick<Vendor, "name" | "category" | "servers">,
): { festival: Festival; vendor: Vendor } {
  const ids = new Set([
    festival.id,
    ...festival.vendors.map((item) => item.id),
    ...festival.stages.map((item) => item.id),
    ...festival.entrances.map((item) => item.id),
    ...festival.paths.map((item) => item.id),
    ...festival.obstacles.map((item) => item.id),
  ]);
  let index = festival.vendors.length + 1;
  while (ids.has(`vendor-${index}`)) index++;
  const size = {
    width: Math.min(6, festival.boundsMeters.width),
    height: Math.min(4, festival.boundsMeters.height),
  };
  const vendor: Vendor = {
    id: `vendor-${index}`,
    name: details.name.trim(),
    category: details.category,
    servers: details.servers,
    position: clampVendorPosition(
      {
        x: festival.boundsMeters.width / 2 + (index % 4) * 8,
        y: festival.boundsMeters.height / 2 + Math.floor((index % 12) / 4) * 8,
      },
      size,
      festival.boundsMeters,
    ),
    size,
    popularity: 0.5,
    averagePrice: 12,
    serviceTimeSeconds: 75,
    inventory: null,
    queueLimit: null,
  };
  return {
    festival: { ...festival, vendors: [...festival.vendors, vendor] },
    vendor,
  };
}

/** Conservative footprint of the stroked centerline, in meters. */
export function pathFootprint(path: PathSegment): {
  position: Point;
  size: Size;
} {
  if (!path.points.length)
    return { position: { x: 0, y: 0 }, size: { width: 0, height: 0 } };
  const xs = path.points.map((p) => p.x),
    ys = path.points.map((p) => p.y);
  const width = Math.max(...xs) - Math.min(...xs),
    height = Math.max(...ys) - Math.min(...ys);
  const xPadding = height === 0 ? 0 : path.widthMeters / 2;
  const yPadding = width === 0 ? 0 : path.widthMeters / 2;
  return {
    position: { x: Math.min(...xs) - xPadding, y: Math.min(...ys) - yPadding },
    size: { width: width + 2 * xPadding, height: height + 2 * yPadding },
  };
}
