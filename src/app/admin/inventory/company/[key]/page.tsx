"use client";

import { useParams } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { parseInventoryCompanyKey } from "@/lib/inventory-companies";
import { InventoryView } from "../../inventory-view";

export default function CompanyInventoryPage() {
  const params = useParams<{ key: string }>();
  const raw = Array.isArray(params.key) ? params.key[0] : params.key;
  const companyKey = parseInventoryCompanyKey(raw);
  if (!companyKey) {
    return <EmptyState title="Unknown inventory catalogue" />;
  }
  return <InventoryView companyKey={companyKey} />;
}
