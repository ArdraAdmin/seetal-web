"use client";

import { useParams } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { parseInventoryCompanyKey } from "@/lib/inventory-companies";
import { CategoriesView } from "../../page";

export default function CompanyCategoriesPage() {
  const params = useParams<{ key: string }>();
  const raw = Array.isArray(params.key) ? params.key[0] : params.key;
  const companyKey = parseInventoryCompanyKey(raw);
  if (!companyKey) {
    return <EmptyState title="Unknown category company" />;
  }
  return <CategoriesView companyKey={companyKey} />;
}
