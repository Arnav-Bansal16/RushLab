export type Id = string;

/** World-space coordinates in meters from the festival bounds origin. */
export interface Point {
  x: number;
  y: number;
}

/** World-space dimensions in meters. */
export interface Size {
  width: number;
  height: number;
}
export interface Entrance {
  id: Id;
  name: string;
  position: Point;
  spawnWeight: number;
}
export interface Stage {
  id: Id;
  name: string;
  position: Point;
  size: Size;
  attraction: number;
}
export interface PathSegment {
  id: Id;
  points: Point[];
  widthMeters: number;
}
export interface Obstacle {
  id: Id;
  points: Point[];
}

export type VendorCategory =
  "food" | "drink" | "merchandise" | "activity" | "other";

export interface Vendor {
  id: Id;
  name: string;
  category: VendorCategory;
  position: Point;
  size: Size;
  popularity: number;
  averagePrice: number;
  serviceTimeSeconds: number;
  servers: number;
  inventory: number | null;
  queueLimit: number | null;
}

export interface Festival {
  schemaVersion: 1;
  id: Id;
  name: string;
  boundsMeters: Size;
  entrances: Entrance[];
  stages: Stage[];
  paths: PathSegment[];
  obstacles: Obstacle[];
  vendors: Vendor[];
}

export type AttendeeStatus =
  "entering" | "walking" | "queued" | "purchasing" | "leaving" | "exited";

export interface AttendeePreferences {
  categoryWeights: Record<VendorCategory, number>;
  priceSensitivity: number;
  queueToleranceSeconds: number;
  exploration: number;
}

export interface Purchase {
  vendorId: Id;
  timeSeconds: number;
  amount: number;
}

export interface Attendee {
  id: Id;
  position: Point;
  status: AttendeeStatus;
  preferences: AttendeePreferences;
  budget: number;
  targetVendorId: Id | null;
  purchases: Purchase[];
}
