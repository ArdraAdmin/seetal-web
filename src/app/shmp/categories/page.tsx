"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CategoryGroup, CategoryRecord } from "@/lib/categories";
import {
  filterCategoryGroups,
  shmpCategoryGroups,
} from "@/lib/shmp-category-groups";
import {
  shmpCategories,
  shmpCreateCategory,
  shmpDeleteCategory,
} from "@/lib/shmp-api";
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

type FormMode = { kind: "add-master" } | { kind: "add-sub" } | null;

const EMPTY_FORM = { masterCategoryName: "", subCategory: "" };

async function readCategoryGroups() {
  const rows = await shmpCategories();
  return shmpCategoryGroups(Array.isArray(rows) ? rows : []);
}

export default function ShmpCategoriesPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FormMode>(null);
  const [saving, setSaving] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openNames, setOpenNames] = useState<Set<string>>(new Set());
  const [form, setForm] = useState(EMPTY_FORM);
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const parsed = await readCategoryGroups();
      if (id !== request.current) return;
      setGroups(parsed);
      setOpenNames(new Set(parsed.map((group) => group.name)));
    } catch (e) {
      if (id !== request.current) return;
      setError(e instanceof Error ? e.message : "Failed to load categories");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = ++request.current;
    let active = true;
    void readCategoryGroups()
      .then((parsed) => {
        if (!active || id !== request.current) return;
        setGroups(parsed);
        setOpenNames(new Set(parsed.map((group) => group.name)));
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active || id !== request.current) return;
        setError(e instanceof Error ? e.message : "Failed to load categories");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(
    () => filterCategoryGroups(groups, query),
    [groups, query],
  );
  const subCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  function startAddMaster() {
    setForm(EMPTY_FORM);
    setMode({ kind: "add-master" });
  }

  function startAddSub() {
    if (groups.length === 0) {
      toast("Add a category first", "info");
      return;
    }
    setForm({
      masterCategoryName: groups[0]?.name || "",
      subCategory: "",
    });
    setMode({ kind: "add-sub" });
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!mode) return;
    const masterCategoryName = form.masterCategoryName.trim();
    const subCategory = form.subCategory.trim();
    if (!masterCategoryName || !subCategory) {
      toast("Category and sub category are required", "info");
      return;
    }
    setSaving(true);
    try {
      await shmpCreateCategory({ masterCategoryName, subCategory });
      setMode(null);
      setForm(EMPTY_FORM);
      toast(
        mode.kind === "add-master" ? "Category created" : "Subcategory created",
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save the category", "error");
      return;
    } finally {
      setSaving(false);
    }
    await load();
  }

  async function onDeleteMaster(group: CategoryGroup) {
    const name = group.name || "this category";
    const confirmed = window.confirm(
      `This will delete the entire category "${name}" and its attached subcategories.`,
    );
    if (!confirmed) return;
    const ids = group.items
      .map((item) => item._id)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) {
      toast("This category cannot be deleted", "info");
      return;
    }
    setDeletingName(name);
    try {
      for (const id of ids) {
        await shmpDeleteCategory(id);
      }
      if (
        mode?.kind === "add-sub" &&
        form.masterCategoryName === group.name
      ) {
        setMode(null);
      }
      toast("Category deleted", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setDeletingName(null);
    }
    await load();
  }

  async function onDeleteSub(item: CategoryRecord) {
    if (!item._id) return;
    if (!confirm(`Delete "${item.subCategory || "this subcategory"}"?`)) return;
    setDeletingId(item._id);
    try {
      await shmpDeleteCategory(item._id);
      toast("Subcategory deleted", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setDeletingId(null);
    }
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Master categories and their subcategories. These belong to SHMP inventory and are separate from the Seetal catalogue."
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
          {subCount} {subCount === 1 ? "subcategory" : "subcategories"} in{" "}
          {groups.length} {groups.length === 1 ? "group" : "groups"}
        </p>
      </Card>

      {mode ? (
        <Card className="mb-5">
          <h2 className="text-base font-semibold text-ink">
            {mode.kind === "add-master" ? "Add category" : "Add subcategory"}
          </h2>
          <form onSubmit={(event) => void onSave(event)}>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {mode.kind === "add-master" ? (
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
              ) : (
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-medium text-slate-700">
                    Master category
                  </span>
                  <select
                    required
                    value={form.masterCategoryName}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        masterCategoryName: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  >
                    <option value="">Select category</option>
                    {groups.map((group) => (
                      <option key={group.name} value={group.name}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={saving}
                onClick={() => setMode(null)}
              >
                Cancel
              </SecondaryButton>
            </div>
          </form>
        </Card>
      ) : null}

      {loading ? (
        <LoadingState label="Loading categories…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : visible.length === 0 ? (
        <EmptyState title="No categories found" />
      ) : (
        <div className="space-y-3">
          {visible.map((group) => {
            const open = openNames.has(group.name);
            return (
              <Card key={group.name}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    aria-expanded={open}
                    onClick={() => {
                      setOpenNames((current) => {
                        const next = new Set(current);
                        if (next.has(group.name)) next.delete(group.name);
                        else next.add(group.name);
                        return next;
                      });
                    }}
                  >
                    <p className="font-semibold text-black">{group.name}</p>
                    <p className="text-xs text-slate-500">
                      {`${group.items.length} ${group.items.length === 1 ? "subcategory" : "subcategories"}`}
                    </p>
                  </button>
                  <SecondaryButton
                    type="button"
                    className="border-red-200 text-red-700"
                    disabled={deletingName === group.name}
                    onClick={() => void onDeleteMaster(group)}
                  >
                    {deletingName === group.name ? "Deleting…" : "Delete"}
                  </SecondaryButton>
                </div>
                {open ? (
                  <ul className="mt-3 divide-y divide-line border-t border-line">
                    {group.items.map((item, index) => (
                      <li
                        key={item._id || `${group.name}-${item.subCategory || index}`}
                        className="flex flex-wrap items-center justify-between gap-2 py-3"
                      >
                        <p className="text-sm font-medium text-black">
                          {item.subCategory || "Untitled"}
                        </p>
                        <SecondaryButton
                          type="button"
                          className="border-red-200 text-red-700"
                          disabled={!item._id || deletingId === item._id}
                          onClick={() => void onDeleteSub(item)}
                        >
                          {deletingId === item._id ? "Deleting…" : "Delete"}
                        </SecondaryButton>
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
