"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createMasterCategory,
  createSubCategory,
  deleteMasterCategory,
  deleteSubCategory,
  editMasterCategory,
  editSubCategory,
  getCategories,
  getCategoryManagers,
  getMasterCategories,
  getWarehouseProfiles,
} from "@/lib/api";
import type { ProfileUser } from "@/lib/types";
import {
  parseCategoryGroups,
  parseMasterCategories,
  mergeCategoryGroups,
  filterCategoryGroupsByCompany,
  buildCreateSubCategoryBody,
  categoryCompany,
  slugDir,
  type CategoryGroup,
  type CategoryRecord,
  type MasterCategoryRecord,
} from "@/lib/categories";
import { useAuth } from "@/components/AuthProvider";
import { companyKeysWithModule } from "@/lib/custom-users";
import {
  INVENTORY_COMPANY_KEYS,
  inventoryCompanyLabel,
  type InventoryCompanyKey,
} from "@/lib/inventory-companies";
import { useToast } from "@/components/Toast";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";

type FormMode =
  | { kind: "add-master" }
  | { kind: "add-sub" }
  | { kind: "edit-master"; group: CategoryGroup }
  | { kind: "edit-sub"; group: CategoryGroup; item: CategoryRecord }
  | null;

export function CategoriesView({
  companyKey = null,
}: {
  companyKey?: InventoryCompanyKey | null;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [masters, setMasters] = useState<MasterCategoryRecord[]>([]);
  const [managers, setManagers] = useState<ProfileUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode>(null);
  const [saving, setSaving] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [openNames, setOpenNames] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    masterCategoryName: "",
    awsMasterCatDir: "",
    masterCategoryId: "",
    subCategory: "",
    awsSubCatDir: "",
    categoryManager: "",
    company: "stl" as InventoryCompanyKey,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryData, masterData, managerData] = await Promise.all([
        getCategories(),
        getMasterCategories(),
        getCategoryManagers().catch(() => getWarehouseProfiles()),
      ]);
      const parsed = mergeCategoryGroups(
        parseCategoryGroups(categoryData),
        parseMasterCategories(masterData),
      );
      setGroups(parsed);
      setMasters(parseMasterCategories(masterData));
      setManagers(
        Array.isArray(managerData)
          ? managerData
          : managerData &&
              typeof managerData === "object" &&
              Array.isArray((managerData as { users?: ProfileUser[] }).users)
            ? (managerData as { users: ProfileUser[] }).users
            : [],
      );
      setOpenNames(new Set(parsed.map((group) => group.name)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const access = user?.customAccess;
  const allowed = access
    ? INVENTORY_COMPANY_KEYS.filter((key) =>
        companyKeysWithModule(access, "categories").includes(key),
      )
    : INVENTORY_COMPANY_KEYS;
  const denied = Boolean(
    companyKey && user?.customAccess && !allowed.includes(companyKey),
  );

  const scoped = useMemo(
    () => filterCategoryGroupsByCompany(groups, companyKey ?? null),
    [groups, companyKey],
  );

  const visible = useMemo(() => {
    const tag = query.trim().toLowerCase();
    if (!tag) return scoped;
    return scoped
      .map((group) => {
        if (group.name.toLowerCase().includes(tag)) return group;
        const items = group.items.filter((item) =>
          String(item.subCategory || "").toLowerCase().includes(tag),
        );
        if (items.length === 0) return null;
        return { ...group, items };
      })
      .filter((group): group is CategoryGroup => Boolean(group));
  }, [scoped, query]);

  const subCount = scoped.reduce((sum, group) => sum + group.items.length, 0);
  const pageCompany = companyKey ?? "stl";

  function startAddMaster() {
    setForm({
      masterCategoryName: "",
      awsMasterCatDir: "",
      masterCategoryId: "",
      subCategory: "",
      awsSubCatDir: "",
      categoryManager: "",
      company: pageCompany,
    });
    setMode({ kind: "add-master" });
  }

  function startAddSub() {
    const first = masters[0] || groups[0];
    setForm({
      masterCategoryName: first ? categoryLabel(first) : "",
      awsMasterCatDir: first?.awsMasterCatDir || "",
      masterCategoryId: first?.masterCategoryId || "",
      subCategory: "",
      awsSubCatDir: "",
      categoryManager: "",
      company: companyKey || categoryCompany(first && "company" in first ? first.company : undefined),
    });
    setMode({ kind: "add-sub" });
  }

  function startEditMaster(group: CategoryGroup) {
    const managerId = asManagerId(group.items[0]?.categoryManager);
    setForm({
      masterCategoryName: group.name,
      awsMasterCatDir: group.awsMasterCatDir,
      masterCategoryId: group.masterCategoryId,
      subCategory: group.items[0]?.subCategory || "",
      awsSubCatDir: group.items[0]?.awsSubCatDir || "",
      categoryManager: managerId,
      company: categoryCompany(group.company),
    });
    setMode({ kind: "edit-master", group });
  }

  function startEditSub(group: CategoryGroup, item: CategoryRecord) {
    setForm({
      masterCategoryName: group.name,
      awsMasterCatDir: item.awsMasterCatDir || group.awsMasterCatDir,
      masterCategoryId: item.masterCategoryId || group.masterCategoryId,
      subCategory: item.subCategory || "",
      awsSubCatDir: item.awsSubCatDir || "",
      categoryManager: asManagerId(item.categoryManager),
      company: categoryCompany(item.company),
    });
    setMode({ kind: "edit-sub", group, item });
  }

  function pickMaster(id: string) {
    const master =
      masters.find((item) => item.masterCategoryId === id) ||
      groups.find((item) => item.masterCategoryId === id);
    setForm((current) => ({
      ...current,
      masterCategoryId: id,
      masterCategoryName: master ? categoryLabel(master) : current.masterCategoryName,
      awsMasterCatDir: master?.awsMasterCatDir || current.awsMasterCatDir,
      company: companyKey ? current.company : categoryCompany(master?.company),
    }));
  }

  async function onSave() {
    if (!mode) return;
    setSaving(true);
    try {
      if (mode.kind === "add-master") {
        const name = form.masterCategoryName.trim();
        const dir = slugDir(name);
        if (!name) {
          toast("Category name is required", "info");
          return;
        }
        if (!dir) {
          toast("Category name must include letters or numbers", "info");
          return;
        }
        await createMasterCategory({
          masterCategoryName: name,
          awsMasterCatDir: dir,
          company: form.company,
        });
        toast("Category created", "success");
      } else if (mode.kind === "add-sub") {
        const body = buildCreateSubCategoryBody(form);
        if (!body.masterCategoryId || !body.masterCategoryName || !body.subCategory) {
          toast("Master category and subcategory are required", "info");
          return;
        }
        if (!body.awsSubCatDir) {
          toast("Subcategory name must include letters or numbers", "info");
          return;
        }
        await createSubCategory(body);
        toast("Subcategory created", "success");
      } else if (mode.kind === "edit-master") {
        if (!form.categoryManager) {
          toast("Select a category manager", "info");
          return;
        }
        await editMasterCategory({
          masterCategoryId: form.masterCategoryId,
          masterCategoryName: form.masterCategoryName.trim(),
          awsMasterCatDir: form.awsMasterCatDir.trim(),
          categoryManager: form.categoryManager,
          subCategory: form.subCategory,
          awsSubCatDir: form.awsSubCatDir,
          company: form.company,
        });
        toast("Category updated", "success");
      } else {
        if (!mode.item._id) {
          toast("This subcategory cannot be edited", "info");
          return;
        }
        await editSubCategory({
          catId: mode.item._id,
          masterCategoryId: form.masterCategoryId,
          masterCategoryName: form.masterCategoryName.trim(),
          subCategory: form.subCategory.trim(),
          awsMasterCatDir: form.awsMasterCatDir.trim(),
          awsSubCatDir: form.awsSubCatDir.trim(),
          company: form.company,
        });
        toast("Subcategory updated", "success");
      }
      setMode(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteMaster(group: CategoryGroup) {
    const name = group.name || "this category";
    const confirmed = window.confirm(
      `This will delete the entire category "${name}" and its attached subcategories.`,
    );
    if (!confirmed) return;
    setDeletingName(name);
    try {
      await deleteMasterCategory({
        masterCategoryId: group.masterCategoryId,
        masterCategoryName: group.name,
      });
      if (
        mode &&
        (mode.kind === "edit-master" || mode.kind === "edit-sub") &&
        mode.group.name === group.name
      ) {
        setMode(null);
      }
      toast("Category deleted", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setDeletingName(null);
    }
  }

  async function onDelete(item: CategoryRecord) {
    if (!item._id) {
      toast("This subcategory cannot be deleted", "info");
      return;
    }
    if (!confirm(`Delete "${item.subCategory || "this subcategory"}"?`)) return;
    try {
      await deleteSubCategory(item._id);
      toast("Subcategory deleted", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title={companyKey ? `${inventoryCompanyLabel(companyKey)} categories` : "Categories"}
        subtitle={
          companyKey
            ? `${inventoryCompanyLabel(companyKey)} main categories and subcategories.`
            : "Every company. Categories with no company set belong to STL."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
              Refresh
            </SecondaryButton>
            <SecondaryButton type="button" onClick={startAddSub}>
              Add subcategory
            </SecondaryButton>
            <PrimaryButton type="button" onClick={startAddMaster}>
              Add category
            </PrimaryButton>
          </div>
        }
      />

      <Card className="mb-5">
        <TextField
          label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Category or subcategory"
        />
        <p className="mt-2 text-xs text-slate-500">
          {subCount} subcategories in {scoped.length} groups
        </p>
      </Card>

      {mode ? (
        <Card className="mb-5">
          <h2 className="text-base font-semibold text-ink">
            {mode.kind === "add-master"
              ? "Add category"
              : mode.kind === "add-sub"
                ? "Add subcategory"
                : mode.kind === "edit-master"
                  ? `Edit ${mode.group.name}`
                  : `Edit ${mode.item.subCategory || "subcategory"}`}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {mode.kind === "add-master" || mode.kind === "edit-master" ? (
              <TextField
                label="Category name"
                required
                value={form.masterCategoryName}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    masterCategoryName: e.target.value,
                  }))
                }
              />
            ) : null}
            {mode.kind === "add-sub" || mode.kind === "edit-sub" ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-medium text-slate-700">
                    Master category
                  </span>
                  <select
                    required
                    value={form.masterCategoryId}
                    onChange={(e) => pickMaster(e.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  >
                    <option value="">Select category</option>
                    {(masters.length > 0 ? masters : groups).map((item) => (
                      <option
                        key={item.masterCategoryId || categoryLabel(item)}
                        value={item.masterCategoryId || ""}
                      >
                        {categoryLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <TextField
                  label="Subcategory"
                  required
                  value={form.subCategory}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      subCategory: e.target.value,
                    }))
                  }
                />
              </>
            ) : null}
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium text-slate-700">Company</span>
              <select
                required
                value={form.company}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    company: categoryCompany(e.target.value),
                  }))
                }
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                {INVENTORY_COMPANY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {inventoryCompanyLabel(key)}
                  </option>
                ))}
              </select>
            </label>
            {mode.kind === "edit-master" ? (
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-[13px] font-medium text-slate-700">
                  Category manager
                </span>
                <select
                  required
                  value={form.categoryManager}
                  onChange={(e) =>
                    setForm({ ...form, categoryManager: e.target.value })
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                >
                  <option value="">Select warehouse manager</option>
                  {managers.map((manager) => (
                    <option key={manager._id} value={manager._id}>
                      {manager.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton type="button" disabled={saving} onClick={() => void onSave()}>
              {saving ? "Saving…" : "Save"}
            </PrimaryButton>
            <SecondaryButton type="button" disabled={saving} onClick={() => setMode(null)}>
              Cancel
            </SecondaryButton>
          </div>
        </Card>
      ) : null}

      {denied ? (
        <EmptyState
          title="You cannot open this company's categories"
          description="This company is not on your account."
        />
      ) : loading ? (
        <LoadingState label="Loading categories…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : visible.length === 0 ? (
        <EmptyState title="No categories found" />
      ) : (
        <div className="space-y-3">
          {visible.map((group) => {
            const open = openNames.has(group.name);
            const canManageMaster =
              !companyKey || categoryCompany(group.company) === companyKey;
            return (
              <Card key={group.masterCategoryId || group.name}>
                <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => {
                      setOpenNames((current) => {
                        const next = new Set(current);
                        if (next.has(group.name)) next.delete(group.name);
                        else next.add(group.name);
                        return next;
                      });
                    }}
                  >
                    <p className="font-semibold text-black">
                      {group.name}
                      <span className="ml-2 text-xs font-medium text-slate-500">
                        {inventoryCompanyLabel(categoryCompany(group.company))}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {group.items.length} subcategor
                      {group.items.length === 1 ? "y" : "ies"}
                    </p>
                  </button>
                  {canManageMaster ? (
                    <div className="flex gap-2">
                      <SecondaryButton
                        type="button"
                        disabled={deletingName === group.name}
                        onClick={() => startEditMaster(group)}
                      >
                        Edit
                      </SecondaryButton>
                      <SecondaryButton
                        type="button"
                        className="border-red-200 text-red-700"
                        disabled={deletingName === group.name}
                        onClick={() => void onDeleteMaster(group)}
                      >
                        {deletingName === group.name ? "Deleting…" : "Delete"}
                      </SecondaryButton>
                    </div>
                  ) : null}
                </div>
                {open ? (
                  <ul className="divide-y divide-line border-t border-line">
                    {group.items.map((item, index) => (
                      <li
                        key={item._id || `${group.name}-${item.subCategory || index}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                      >
                        <p className="text-sm font-medium text-black">
                          {item.subCategory || "Untitled"}
                          <span className="ml-2 text-xs font-medium text-slate-500">
                            {inventoryCompanyLabel(categoryCompany(item.company))}
                          </span>
                        </p>
                        <div className="flex gap-2">
                          <SecondaryButton
                            type="button"
                            onClick={() => startEditSub(group, item)}
                          >
                            Edit
                          </SecondaryButton>
                          <SecondaryButton
                            type="button"
                            className="border-red-200 text-red-700"
                            onClick={() => void onDelete(item)}
                          >
                            Delete
                          </SecondaryButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  return <CategoriesView />;
}

function asManagerId(value: CategoryRecord["categoryManager"]) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value._id || "";
}

function categoryLabel(item: CategoryGroup | MasterCategoryRecord) {
  if ("masterCategoryName" in item && item.masterCategoryName) {
    return item.masterCategoryName;
  }
  if ("name" in item && item.name) return item.name;
  return item.masterCategoryId || "";
}
