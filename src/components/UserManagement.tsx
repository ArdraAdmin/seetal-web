"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CustomUserList } from "@/components/CustomUserList";
import { ProfilesList } from "@/components/ProfilesList";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { getAdminProfiles, getSalesProfiles, getWarehouseProfiles } from "@/lib/api";
import { shmpAccessUsers, shmpEmployees } from "@/lib/shmp-api";
import {
  parseUserGroup,
  readAccessPeople,
  readPortalAdmins,
  readWorkers,
  userGroupsForSide,
  userManagementPath,
  USER_GROUP_LABELS,
  withReturnTo,
  type DirectoryPerson,
  type UserGroup,
  type UserManagementSide,
} from "@/lib/user-management";

const ADD_CLASS =
  "inline-flex min-h-10 items-center rounded-lg border border-brand bg-brand px-4 py-2 text-sm font-medium text-ink hover:bg-brand-dark hover:text-white";

export function UserManagement({ side }: { side: UserManagementSide }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const group = parseUserGroup(side, searchParams.get("group"));
  const [reloadKey, setReloadKey] = useState(0);
  const groups = userGroupsForSide(side);
  const returnTo = userManagementPath(side, group);

  function selectGroup(next: UserGroup) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("group", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const add =
    side === "admin"
      ? group === "sales"
        ? {
            href: withReturnTo("/admin/profiles/sales/new", returnTo),
            label: "Add",
          }
        : group === "warehouse"
          ? {
              href: withReturnTo("/admin/profiles/warehouse/new", returnTo),
              label: "Add",
            }
          : group === "custom"
            ? { href: `${pathname}/new`, label: "Create user" }
            : null
      : group === "custom"
        ? { href: `${pathname}/new`, label: "Create user" }
        : { href: "/shmp/hr", label: "Add in HR" };

  return (
    <div>
      <PageHeader
        title="User management"
        subtitle={
          side === "admin"
            ? "Sales accounts, warehouse accounts, admins, and custom users."
            : "Supervisors, factory workers, and custom users."
        }
        actions={
          <div className="flex gap-2">
            <SecondaryButton
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Refresh
            </SecondaryButton>
            {add ? (
              <Link href={add.href} className={ADD_CLASS}>
                {add.label}
              </Link>
            ) : null}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="User types">
        {groups.map((item) => {
          const selected = group === item;
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectGroup(item)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                selected
                  ? "border-brand bg-brand text-ink"
                  : "border-line bg-white text-slate-700 hover:bg-[#f7f5f0]"
              }`}
            >
              {USER_GROUP_LABELS[item]}
            </button>
          );
        })}
      </div>
      {side === "admin" && group === "sales" ? (
        <ProfilesList
          key={`sales-${reloadKey}`}
          embedded
          returnTo={returnTo}
          title="Sales profiles"
          role="Sales"
          editBase="/admin/profiles/sales"
          addHref="/admin/profiles/sales/new"
          addLabel="Add"
          fetcher={getSalesProfiles}
        />
      ) : null}
      {side === "admin" && group === "warehouse" ? (
        <ProfilesList
          key={`warehouse-${reloadKey}`}
          embedded
          returnTo={returnTo}
          title="Warehouse profiles"
          role="Warehouse"
          editBase="/admin/profiles/warehouse"
          addHref="/admin/profiles/warehouse/new"
          addLabel="Add"
          fetcher={getWarehouseProfiles}
        />
      ) : null}
      {side === "admin" && group === "admins" ? (
        <PeopleList
          key={`admins-${reloadKey}`}
          emptyTitle="No admins yet"
          emptyDescription="STL admin accounts show up here."
          load={loadAdmins}
        />
      ) : null}
      {group === "custom" ? (
        <CustomUserList
          key={`custom-${reloadKey}`}
          embedded
          side={side}
          basePath={pathname}
        />
      ) : null}
      {side === "shmp" && group === "supervisor" ? (
        <PeopleList
          key={`supervisor-${reloadKey}`}
          emptyTitle="No supervisors yet"
          emptyDescription="Add a supervisor from HR."
          load={loadSupervisors}
          hrefFor={(person) =>
            withReturnTo(`/shmp/hr/user/${person.id}`, returnTo)
          }
        />
      ) : null}
      {side === "shmp" && group === "workers" ? (
        <PeopleList
          key={`workers-${reloadKey}`}
          emptyTitle="No workers yet"
          emptyDescription="Add a factory worker from HR."
          load={loadWorkers}
          hrefFor={(person) =>
            withReturnTo(`/shmp/hr/worker/${person.id}`, returnTo)
          }
        />
      ) : null}
    </div>
  );
}

async function loadAdmins() {
  return readPortalAdmins(await getAdminProfiles());
}

async function loadSupervisors() {
  return readAccessPeople(await shmpAccessUsers("Supervisor"), "Supervisor");
}

async function loadWorkers() {
  return readWorkers(await shmpEmployees());
}

function PeopleList({
  emptyTitle,
  emptyDescription,
  load,
  hrefFor,
}: {
  emptyTitle: string;
  emptyDescription: string;
  load: () => Promise<DirectoryPerson[]>;
  hrefFor?: (person: DirectoryPerson) => string;
}) {
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setPeople(await load());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .then((rows) => {
        if (!cancelled) setPeople(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load users");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const term = query.trim().toLowerCase();
  const rows = term
    ? people.filter((person) =>
        `${person.name} ${person.email} ${person.mobile} ${person.detail}`
          .toLowerCase()
          .includes(term),
      )
    : people;

  return (
    <div>
      <div className="mb-4 max-w-sm">
        <TextField
          label="Search"
          placeholder="Name, email or phone"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={people.length === 0 ? emptyTitle : "No users match this search"}
          description={people.length === 0 ? emptyDescription : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-[#f7f5f0] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Phone</th>
                <th className="px-4 py-2">Details</th>
                {hrefFor ? <th className="px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((person) => (
                <tr key={person.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{person.name}</td>
                  <td className="px-4 py-3 text-slate-600">{person.email || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{person.mobile || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{person.detail}</td>
                  {hrefFor ? (
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={hrefFor(person)}
                        className="font-medium text-brand-dark hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
