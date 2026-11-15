import type {
  AttendeeFrameState,
  AttendeeStatus,
  Festival,
  VendorFrameState,
} from "../../domain";

export const statusStyles: Record<
  AttendeeStatus,
  { label: string; color: string; opacity: number }
> = {
  entering: { label: "Entering", color: "#559caf", opacity: 1 },
  choosing: { label: "Choosing", color: "#6f72b8", opacity: 1 },
  walking: { label: "Walking", color: "#286baf", opacity: 1 },
  roaming: { label: "Roaming", color: "#4b7e9a", opacity: 1 },
  queued: { label: "Queued", color: "#a56b09", opacity: 1 },
  purchasing: { label: "In service", color: "#21815b", opacity: 1 },
  dwelling: { label: "Dwelling", color: "#367963", opacity: 1 },
  leaving: { label: "Leaving festival", color: "#c0268c", opacity: 1 },
  exited: { label: "Exited", color: "#67736d", opacity: 0.25 },
};
export const betweenStopsStyle = {
  label: "Moving to next stop",
  color: "#d26917",
  opacity: 1,
};
export function attendeeStyle(attendee: AttendeeFrameState) {
  return attendee.status === "walking" && (attendee.completedStops ?? 0) > 0
    ? betweenStopsStyle
    : statusStyles[attendee.status];
}
export function attendeeDescription(
  attendee: AttendeeFrameState,
  festival: Festival,
): string {
  const genericTarget = attendee.target;
  const target = genericTarget
    ? genericTarget.destinationType === "vendor"
      ? (festival.vendors.find(
          (vendor) => vendor.id === genericTarget.destinationId,
        )?.name ?? genericTarget.destinationId)
      : genericTarget.destinationType === "stage"
        ? (festival.stages.find(
            (stage) => stage.id === genericTarget.destinationId,
          )?.name ?? genericTarget.destinationId)
        : ((festival.amenities ?? []).find(
            (amenity) => amenity.id === genericTarget.destinationId,
          )?.name ?? genericTarget.destinationId)
    : attendee.target !== undefined || attendee.targetVendorId === null
      ? "No destination"
      : (festival.vendors.find(
          (vendor) => vendor.id === attendee.targetVendorId,
        )?.name ?? attendee.targetVendorId);
  return `${attendee.id} · ${attendeeStyle(attendee).label} · ${target}`;
}
export function vendorDisplay(state: VendorFrameState) {
  return {
    queue: state.queueLength,
    inventory:
      state.inventoryRemaining === null
        ? "Unlimited"
        : String(state.inventoryRemaining),
    sales: state.cumulativeSales,
  };
}
