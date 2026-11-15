import type { SimulationEvent, SimulationFrame, Vendor } from "../../domain";

/** Shared event reducer for final and recorded-moment business values. */
export function createBusinessLedger(vendorIds: string[]) {
  const values = new Map(
    vendorIds.map((id) => [
      id,
      { revenue: 0, missedSales: 0, missedSaleValue: 0 },
    ]),
  );
  return {
    apply(event: SimulationEvent) {
      if (event.type !== "purchase" && event.type !== "missed_sale") return;
      const value = values.get(event.vendorId);
      if (!value)
        throw new Error(`Unknown business event vendor ${event.vendorId}`);
      const amount =
        event.type === "purchase" ? event.amount : event.missedSaleValue;
      if (!Number.isFinite(amount) || amount < 0)
        throw new Error("Invalid business event amount");
      if (event.type === "purchase") value.revenue += amount;
      else {
        value.missedSales += 1;
        value.missedSaleValue += amount;
      }
    },
    get(id: string) {
      const value = values.get(id);
      if (!value) throw new Error(`Unknown business vendor ${id}`);
      return { ...value };
    },
  };
}

/** One pass over ordered canonical events; frames remain presentation snapshots. */
export function withBusinessSnapshots(
  events: SimulationEvent[],
  frames: SimulationFrame[],
  vendors: Vendor[],
): SimulationFrame[] {
  const ledger = createBusinessLedger(vendors.map((v) => v.id));
  let cursor = 0;
  return frames.map((frame) => {
    while (
      cursor < events.length &&
      events[cursor].timeSeconds <= frame.timeSeconds
    )
      ledger.apply(events[cursor++]);
    return {
      ...frame,
      vendors: frame.vendors.map((vendor) => {
        const value = ledger.get(vendor.vendorId);
        return {
          ...vendor,
          cumulativeRevenue: value.revenue,
          cumulativeMissedSales: value.missedSales,
          cumulativeMissedSaleValue: value.missedSaleValue,
        };
      }),
    };
  });
}
