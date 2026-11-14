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
  walking: { label: "Walking", color: "#286baf", opacity: 1 },
  queued: { label: "Queued", color: "#a56b09", opacity: 1 },
  purchasing: { label: "In service", color: "#21815b", opacity: 1 },
  leaving: { label: "Leaving", color: "#a44980", opacity: 1 },
  exited: { label: "Exited", color: "#67736d", opacity: 0.25 },
};
export function attendeeDescription(
  attendee: AttendeeFrameState,
  festival: Festival,
): string {
  const target =
    attendee.targetVendorId === null
      ? "No target vendor"
      : (festival.vendors.find(
          (vendor) => vendor.id === attendee.targetVendorId,
        )?.name ?? attendee.targetVendorId);
  return `${attendee.id} · ${statusStyles[attendee.status].label} · ${target}`;
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
