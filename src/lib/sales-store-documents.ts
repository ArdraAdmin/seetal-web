import {
  EXPIRY_ALERT_DAYS,
  calendarDaysUntil,
  isExpiringWithinDays,
  type ExpiryAlertRow,
} from "./expiry-window";
import { formatTradeLicenseDate } from "./store-documents";
import { storeTitle } from "./sales";
import type { StoreProfile } from "./types";

function asNowMs(now: Date | number = Date.now()) {
  return typeof now === "number" ? now : now.getTime();
}

export function storeTradeLicenseDue(
  store: Pick<StoreProfile, "tradeLicenseExpiry">,
  now: Date | number = Date.now(),
) {
  return isExpiringWithinDays(
    store.tradeLicenseExpiry,
    EXPIRY_ALERT_DAYS,
    asNowMs(now),
  );
}

export function storesWithDueTradeLicenses(
  stores: StoreProfile[],
  now: Date | number = Date.now(),
) {
  return stores.filter((store) => storeTradeLicenseDue(store, now));
}

export function tradeLicenseAlertRows(
  stores: StoreProfile[],
  now: Date | number = Date.now(),
): ExpiryAlertRow[] {
  const nowMs = asNowMs(now);
  return storesWithDueTradeLicenses(stores, nowMs)
    .map((store) => {
      const daysRemaining = calendarDaysUntil(store.tradeLicenseExpiry, nowMs);
      const expiryDate = formatTradeLicenseDate(store.tradeLicenseExpiry);
      const eid = storeEidLabel(store);
      return {
        id: store._id,
        title: storeTitle(store),
        detail: eid ? `EID ${eid}` : undefined,
        expiryDate,
        href: `#store-document-${store._id}`,
        daysRemaining: daysRemaining ?? 0,
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export function storeEidLabel(store: Pick<StoreProfile, "eidNumber">) {
  const eid = String(store.eidNumber || "").trim();
  return eid || "";
}
