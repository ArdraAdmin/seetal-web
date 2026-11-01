"use client";

import { useEffect, useState } from "react";
import { ApiError, fetchSalesStoreAccess } from "@/lib/api";
import { loadDownloadedStores } from "@/lib/sales-company";
import { storeAssignedToSalesman } from "@/lib/sales";
import {
  BLOCKED_STORE_MESSAGE,
  storeOrderBlocked,
} from "@/lib/store-access";
import type { StoreProfile } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";

export type SalesStoreAccessState = {
  status: "loading" | "open" | "blocked" | "denied";
  message: string;
};

export function useSalesStoreAccess(storeId: string): SalesStoreAccessState {
  const { user } = useAuth();
  const [state, setState] = useState<SalesStoreAccessState>({
    status: "loading",
    message: "",
  });

  useEffect(() => {
    if (!user?.id || !storeId) return;
    let cancel = false;
    const userId = user.id;

    function fromCache(): SalesStoreAccessState | null {
      const cached = loadDownloadedStores().find(
        (store) => String(store._id) === storeId,
      ) as StoreProfile | undefined;
      if (!cached) return null;
      if (!storeAssignedToSalesman(cached, userId)) {
        return {
          status: "denied",
          message: "You don't have access to this store.",
        };
      }
      if (storeOrderBlocked(cached)) {
        return { status: "blocked", message: BLOCKED_STORE_MESSAGE };
      }
      return null;
    }

    fetchSalesStoreAccess(storeId, userId)
      .then((access) => {
        if (cancel) return;
        if (!access.assigned) {
          setState({
            status: "denied",
            message: "You don't have access to this store.",
          });
          return;
        }
        setState(
          access.orderBlocked
            ? { status: "blocked", message: BLOCKED_STORE_MESSAGE }
            : { status: "open", message: "" },
        );
      })
      .catch((error: unknown) => {
        if (cancel) return;
        const cached = fromCache();
        if (cached) {
          setState(cached);
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          setState({
            status: "denied",
            message: error.message || "You don't have access to this store.",
          });
          return;
        }
        setState({ status: "open", message: "" });
      });

    return () => {
      cancel = true;
    };
  }, [storeId, user?.id]);

  return state;
}
