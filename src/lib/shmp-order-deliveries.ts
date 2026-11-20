export type OrderDeliveryLine = {
  qty?: number;
  product?: { _id?: string; itemName?: string; itemRef?: string } | string | null;
};

export type OrderDeliveryTrip = {
  _id?: string;
  deliveryDate?: string;
  vehicleNumber?: number | string | null;
  remarks?: string | null;
  vehicle?: { value?: number | string } | string | null;
  tempOrder?: { _id?: string } | string | null;
  lines?: OrderDeliveryLine[];
};

export function deliveryTripOrderId(trip: OrderDeliveryTrip) {
  const order = trip.tempOrder;
  if (!order) return "";
  if (typeof order === "string") return order;
  return String(order._id || "");
}

/** Keep only trips that belong to this order. */
export function tripsForOrder(trips: OrderDeliveryTrip[], orderId: string) {
  const id = String(orderId || "");
  if (!id) return [];
  return (trips || []).filter((trip) => deliveryTripOrderId(trip) === id);
}

export function deliveryVehicleLabel(trip: OrderDeliveryTrip) {
  const vehicle = trip.vehicle;
  if (
    vehicle &&
    typeof vehicle === "object" &&
    vehicle.value != null &&
    vehicle.value !== ""
  ) {
    return `#${vehicle.value}`;
  }
  if (trip.vehicleNumber != null && trip.vehicleNumber !== "") {
    return `#${trip.vehicleNumber}`;
  }
  const remarks = String(trip.remarks || "");
  if (remarks.startsWith("Vehicle ")) return remarks.slice("Vehicle ".length);
  return "Vehicle not recorded";
}

export function deliveryTripCartons(trip: OrderDeliveryTrip) {
  return (trip.lines || []).reduce(
    (sum, line) => sum + (Number(line.qty) || 0),
    0,
  );
}

export function deliveryLineName(line: OrderDeliveryLine) {
  const product = line.product;
  if (product && typeof product === "object") {
    return product.itemName || product.itemRef || "Item";
  }
  return "Item";
}

/** Unique vehicle labels in trip order (first appearance wins). */
export function deliveryVehicleSummary(trips: OrderDeliveryTrip[]) {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const trip of trips) {
    const label = deliveryVehicleLabel(trip);
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}
