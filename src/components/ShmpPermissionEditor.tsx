"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getHrStaff } from "@/lib/stl-features-api";
import {
  shmpAccessUsers,
  shmpCategories,
  shmpEmployees,
  shmpInventory,
  shmpOrders,
  shmpStoreSalesmen,
  shmpStores,
} from "@/lib/shmp-api";
import { modulesForCompany } from "@/lib/custom-users";
import {
  SHMP_DASHBOARD_FIELDS,
  SHMP_GRANULAR_MODULES,
  SHMP_HR_FIELDS,
  SHMP_INVENTORY_FIELDS,
  SHMP_PAYROLL_FIELDS,
  SHMP_PRODUCTION_CARDS,
  SHMP_STORE_FIELDS,
  grantWhenEnabled,
  type Crud,
  type IdScope,
  type OrderScope,
  type ShmpField,
  type ShmpGrantMap,
  type ShmpPermissions,
} from "@/lib/shmp-permissions";

type Option = { id: string; label: string };

function Switch({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-brand" : "bg-slate-300"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-1 py-1">
      <span className="text-sm text-ink">{label}</span>
      <Switch on={on} label={label} onClick={onClick} />
    </div>
  );
}

function CrudToggles({
  value,
  onChange,
}: {
  value: Crud;
  onChange: (value: Crud) => void;
}) {
  const actions: Array<keyof Crud> = ["create", "read", "update", "delete"];
  return (
    <div>
      {actions.map((action) => (
        <ToggleRow
          key={action}
          on={value[action]}
          label={action[0].toUpperCase() + action.slice(1)}
          onClick={() => onChange({ ...value, [action]: !value[action] })}
        />
      ))}
    </div>
  );
}

function FieldToggles({
  fields,
  value,
  onChange,
}: {
  fields: ShmpField[];
  value: Record<string, boolean>;
  onChange: (value: Record<string, boolean>) => void;
}) {
  let lastGroup = "";
  const allOn = fields.every((field) => value[field.id]);
  return (
    <div className="space-y-1">
      <div className="flex gap-3 text-xs">
        <button type="button" className="underline" onClick={() => onChange(Object.fromEntries(fields.map((field) => [field.id, true])))}>
          All fields
        </button>
        <button type="button" className="underline" onClick={() => onChange(Object.fromEntries(fields.map((field) => [field.id, false])))}>
          No fields
        </button>
        <span className="text-slate-500">{allOn ? "All visible" : "Some hidden"}</span>
      </div>
      {fields.map((field) => {
        const showGroup = field.group && field.group !== lastGroup;
        if (field.group) lastGroup = field.group;
        return (
          <div key={field.id}>
            {showGroup ? (
              <p className="px-1 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{field.group}</p>
            ) : null}
            <ToggleRow
              on={value[field.id] === true}
              label={field.label}
              onClick={() => onChange({ ...value, [field.id]: !value[field.id] })}
            />
          </div>
        );
      })}
    </div>
  );
}

function IdScopeEditor({
  title,
  scope,
  onChange,
  loadOptions,
  hideMode = false,
}: {
  title: string;
  scope: IdScope;
  onChange: (scope: IdScope) => void;
  loadOptions: () => Promise<Option[]>;
  hideMode?: boolean;
}) {
  const [options, setOptions] = useState<Option[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hideMode || options) return;
    let cancelled = false;
    void loadOptions()
      .then((rows) => {
        if (!cancelled) setOptions(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the list");
      });
    return () => {
      cancelled = true;
    };
  }, [hideMode]);

  async function chooseSelected() {
    onChange(scope.mode === "selected" ? scope : { mode: "selected", ids: [] });
    if (options) return;
    try {
      setOptions(await loadOptions());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the list");
    }
  }

  const shown = (options || []).filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hideMode ? null : (
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={scope.mode === "all"}
            onChange={() => onChange({ mode: "all" })}
          />
          All
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={scope.mode === "selected"} onChange={() => void chooseSelected()} />
          Selected only
        </label>
      </div>
      )}
      {scope.mode === "selected" || hideMode ? (
        <div className="rounded-lg bg-white p-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="mb-2 w-full rounded-md border border-line px-2 py-1 text-sm"
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {!options && !error ? <p className="text-sm text-slate-500">Loading…</p> : null}
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {shown.map((option) => {
              const selectedIds = scope.mode === "selected" ? scope.ids : [];
              const checked = selectedIds.includes(option.id);
              return (
                <li key={option.id}>
                  <ToggleRow
                    on={checked}
                    label={option.label}
                    onClick={() =>
                      onChange({
                        mode: "selected",
                        ids: checked
                          ? selectedIds.filter((id) => id !== option.id)
                          : [...selectedIds, option.id],
                      })
                    }
                  />
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-xs text-slate-500">{scope.mode === "selected" ? scope.ids.length : 0} selected</p>
        </div>
      ) : null}
    </div>
  );
}

export function ShmpPermissionEditor({
  modules,
  permissions,
  onChange,
}: {
  modules: string[];
  permissions: ShmpPermissions;
  onChange: (modules: string[], permissions: ShmpPermissions) => void;
}) {
  const { user } = useAuth();
  const grants = permissions.shmp;
  const catalog = modulesForCompany("shmp");

  function setGrant<K extends keyof ShmpGrantMap>(id: K, grant: ShmpGrantMap[K]) {
    onChange(modules, { version: 1, shmp: { ...grants, [id]: grant } });
  }

  function toggleModule(id: string) {
    const on = modules.includes(id);
    const nextModules = on ? modules.filter((item) => item !== id) : [...modules, id];
    const shmp = { ...grants };
    if (on) delete shmp[id as keyof ShmpGrantMap];
    else if ((SHMP_GRANULAR_MODULES as readonly string[]).includes(id)) {
      shmp[id as keyof ShmpGrantMap] = grantWhenEnabled(id) as never;
    }
    onChange(nextModules, { version: 1, shmp });
  }

  async function loadPeople(): Promise<Option[]> {
    if (!user?.id) return [];
    const [staff, employees, accessUsers] = await Promise.all([
      getHrStaff(user.id, { scope: "shmp" }).catch(() => ({ staff: [] })),
      shmpEmployees().catch(() => []),
      shmpAccessUsers().catch(() => []),
    ]);
    const options: Option[] = [];
    const seen = new Set<string>();
    function add(id: unknown, label: string) {
      const key = String(id || "");
      if (!key || seen.has(key)) return;
      seen.add(key);
      options.push({ id: key, label });
    }
    for (const row of staff.staff || []) add(row.id, `${row.name || "Staff"} · HR`);
    for (const row of employees as Array<{ _id?: string; name?: string; designation?: string }>) {
      add(row._id, `${row.name || "Worker"} · ${row.designation || "Worker"}`);
    }
    for (const row of accessUsers) add(row._id, `${row.name || row.email || "User"} · ${row.role || "User"}`);
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }

  async function loadSalesmen() {
    const rows = await shmpStoreSalesmen();
    return rows.map((row) => ({ id: row._id, label: row.name || row.email || "Salesman" }));
  }

  async function loadItems() {
    const rows = await shmpInventory({ ownOnly: "1", excludeStl: "1" });
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row._id,
      label: [row.itemName, row.itemRef].filter(Boolean).join(" · ") || "Item",
    }));
  }

  async function loadCategories() {
    const rows = await shmpCategories();
    return rows.map((row) => ({
      id: row._id,
      label: [row.masterCategoryName, row.subCategory].filter(Boolean).join(" · "),
    }));
  }

  async function loadOrders() {
    const rows = (await shmpOrders()) as Array<{ _id?: string; tempOrderInvoiceNo?: string; store?: { storeName?: string } }>;
    return rows.map((row) => ({
      id: String(row._id || ""),
      label: [row.tempOrderInvoiceNo, row.store?.storeName].filter(Boolean).join(" · ") || "Order",
    }));
  }

  async function loadStores() {
    const rows = await shmpStores();
    return rows.map((row) => ({ id: row._id, label: row.storeName || row.uid || "Store" }));
  }

  return (
    <ul className="mt-4 divide-y divide-line">
      {catalog.map((item) => {
        const on = modules.includes(item.id);
        const granular = (SHMP_GRANULAR_MODULES as readonly string[]).includes(item.id);
        return (
          <li key={item.id} className="py-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-ink">{item.label}</span>
              <Switch on={on} label={item.label} onClick={() => toggleModule(item.id)} />
            </div>
            {on && granular ? (
              <div className="mt-3 space-y-3 rounded-lg bg-[#f7f5f0] px-3 py-3">
                <ModuleDetail
                  id={item.id}
                  grant={grants[item.id as keyof ShmpGrantMap]}
                  onChange={(grant) => setGrant(item.id as keyof ShmpGrantMap, grant as never)}
                  loadPeople={loadPeople}
                  loadSalesmen={loadSalesmen}
                  loadItems={loadItems}
                  loadCategories={loadCategories}
                  loadOrders={loadOrders}
                  loadStores={loadStores}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function ModuleDetail({
  id,
  grant,
  onChange,
  loadPeople,
  loadSalesmen,
  loadItems,
  loadCategories,
  loadOrders,
  loadStores,
}: {
  id: string;
  grant: ShmpGrantMap[keyof ShmpGrantMap];
  onChange: (grant: ShmpGrantMap[keyof ShmpGrantMap]) => void;
  loadPeople: () => Promise<Option[]>;
  loadSalesmen: () => Promise<Option[]>;
  loadItems: () => Promise<Option[]>;
  loadCategories: () => Promise<Option[]>;
  loadOrders: () => Promise<Option[]>;
  loadStores: () => Promise<Option[]>;
}) {
  if (!grant) return null;
  if (id === "dashboard" && "fields" in grant) {
    return <FieldToggles fields={SHMP_DASHBOARD_FIELDS} value={grant.fields} onChange={(fields) => onChange({ fields })} />;
  }
  if (id === "approvals" && "approve" in grant) {
    return (
      <div>
        <ToggleRow on={grant.read} label="Read access" onClick={() => onChange({ ...grant, read: !grant.read })} />
        <ToggleRow on={grant.approve} label="Approval rights" onClick={() => onChange({ ...grant, approve: !grant.approve })} />
      </div>
    );
  }
  if (id === "hr" && "actions" in grant && "users" in grant && "fields" in grant) {
    return (
      <div className="space-y-3">
        <CrudToggles value={grant.actions} onChange={(actions) => onChange({ ...grant, actions })} />
        <IdScopeEditor title="Whose HR records" scope={grant.users} onChange={(users) => onChange({ ...grant, users })} loadOptions={loadPeople} />
        <FieldToggles fields={SHMP_HR_FIELDS} value={grant.fields} onChange={(fields) => onChange({ ...grant, fields })} />
      </div>
    );
  }
  if (id === "payroll" && "edit" in grant && "users" in grant) {
    return (
      <div className="space-y-3">
        <ToggleRow on={grant.edit} label="Can edit payroll" onClick={() => onChange({ ...grant, edit: !grant.edit })} />
        <IdScopeEditor title="Whose payroll" scope={grant.users} onChange={(users) => onChange({ ...grant, users })} loadOptions={loadPeople} />
        <FieldToggles fields={SHMP_PAYROLL_FIELDS} value={grant.fields} onChange={(fields) => onChange({ ...grant, fields })} />
      </div>
    );
  }
  if (id === "attendance" && "fines" in grant && "attendance" in grant) {
    return (
      <div className="space-y-3">
        <IdScopeEditor title="Whose attendance" scope={grant.users} onChange={(users) => onChange({ ...grant, users })} loadOptions={loadPeople} />
        <div>
          <p className="mb-1 text-sm font-medium text-ink">Attendance</p>
          <CrudToggles value={grant.attendance} onChange={(attendance) => onChange({ ...grant, attendance })} />
        </div>
        <ToggleRow
          on={grant.editExisting}
          label="Can edit existing attendance"
          onClick={() => onChange({ ...grant, editExisting: !grant.editExisting })}
        />
        <div>
          <p className="mb-1 text-sm font-medium text-ink">Fines</p>
          <CrudToggles value={grant.fines} onChange={(fines) => onChange({ ...grant, fines })} />
        </div>
      </div>
    );
  }
  if (id === "stores" && "block" in grant && "salesmen" in grant && "actions" in grant) {
    return (
      <div className="space-y-3">
        <CrudToggles value={grant.actions} onChange={(actions) => onChange({ ...grant, actions })} />
        <ToggleRow on={grant.block} label="Can block a store" onClick={() => onChange({ ...grant, block: !grant.block })} />
        <IdScopeEditor title="Salesmen they can see" scope={grant.salesmen} onChange={(salesmen) => onChange({ ...grant, salesmen })} loadOptions={loadSalesmen} />
        <FieldToggles fields={SHMP_STORE_FIELDS} value={grant.fields} onChange={(fields) => onChange({ ...grant, fields })} />
      </div>
    );
  }
  if (id === "inventory" && "items" in grant && "actions" in grant && "fields" in grant) {
    return (
      <div className="space-y-3">
        <CrudToggles value={grant.actions} onChange={(actions) => onChange({ ...grant, actions })} />
        <IdScopeEditor title="Inventory items" scope={grant.items} onChange={(items) => onChange({ ...grant, items })} loadOptions={loadItems} />
        <FieldToggles fields={SHMP_INVENTORY_FIELDS} value={grant.fields} onChange={(fields) => onChange({ ...grant, fields })} />
      </div>
    );
  }
  if (id === "categories" && "categories" in grant && "actions" in grant) {
    return (
      <div className="space-y-3">
        <CrudToggles value={grant.actions} onChange={(actions) => onChange({ ...grant, actions })} />
        <IdScopeEditor title="Categories" scope={grant.categories} onChange={(categories) => onChange({ ...grant, categories })} loadOptions={loadCategories} />
      </div>
    );
  }
  if (id === "catalog" && "uploadImages" in grant && "items" in grant && "actions" in grant) {
    return (
      <div className="space-y-3">
        <CrudToggles value={grant.actions} onChange={(actions) => onChange({ ...grant, actions })} />
        <ToggleRow
          on={grant.uploadImages}
          label="Can upload or change catalog images"
          onClick={() => onChange({ ...grant, uploadImages: !grant.uploadImages })}
        />
        <IdScopeEditor title="Catalog items" scope={grant.items} onChange={(items) => onChange({ ...grant, items })} loadOptions={loadItems} />
        <p className="text-xs text-slate-500">Inventory item limits also apply when that module is restricted.</p>
      </div>
    );
  }
  if (id === "production" && "orders" in grant && "cards" in grant) {
    const orders = grant.orders;
    return (
      <div className="space-y-3">
        <OrderScopeEditor
          scope={orders}
          onChange={(next) => onChange({ ...grant, orders: next })}
          loadOrders={loadOrders}
          loadStores={loadStores}
        />
        <ToggleRow
          on={grant.logs}
          label="Can view production logs"
          onClick={() => onChange({ ...grant, logs: !grant.logs })}
        />
        <FieldToggles fields={SHMP_PRODUCTION_CARDS} value={grant.cards} onChange={(cards) => onChange({ ...grant, cards })} />
      </div>
    );
  }
  return null;
}

function OrderScopeEditor({
  scope,
  onChange,
  loadOrders,
  loadStores,
}: {
  scope: OrderScope;
  onChange: (scope: OrderScope) => void;
  loadOrders: () => Promise<Option[]>;
  loadStores: () => Promise<Option[]>;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">Orders</p>
      <div className="flex flex-wrap gap-3 text-sm">
        {([
          ["all", "All orders"],
          ["orders", "Selected orders"],
          ["stores", "Orders for selected stores"],
        ] as const).map(([mode, label]) => (
          <label key={mode} className="flex items-center gap-2">
            <input
              type="radio"
              checked={scope.mode === mode}
              onChange={() => onChange(mode === "all" ? { mode: "all" } : { mode, ids: scope.mode === mode ? scope.ids : [] })}
            />
            {label}
          </label>
        ))}
      </div>
      {scope.mode === "orders" ? (
        <IdScopeEditor
          title="Orders"
          hideMode
          scope={{ mode: "selected", ids: scope.ids }}
          onChange={(next) => onChange({ mode: "orders", ids: next.mode === "selected" ? next.ids : [] })}
          loadOptions={loadOrders}
        />
      ) : null}
      {scope.mode === "stores" ? (
        <IdScopeEditor
          title="Stores"
          hideMode
          scope={{ mode: "selected", ids: scope.ids }}
          onChange={(next) => onChange({ mode: "stores", ids: next.mode === "selected" ? next.ids : [] })}
          loadOptions={loadStores}
        />
      ) : null}
    </div>
  );
}
