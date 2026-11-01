"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { FieldLabel } from "@/components/ui";

export type SearchableSelectOption = {
  id: string;
  label: string;
  searchText?: string;
};

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Search…",
  emptyOption,
  optional = false,
  disabled = false,
}: {
  label: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyOption?: SearchableSelectOption;
  optional?: boolean;
  disabled?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((option) => option.id === value);
  const selectedLabel =
    selected?.label ||
    (value === (emptyOption?.id ?? "") ? emptyOption?.label : "") ||
    "";

  const filtered = useMemo(() => {
    const rows = emptyOption ? [emptyOption, ...options] : options;
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((option) => {
      const haystack = `${option.label} ${option.searchText || ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [emptyOption, options, query]);

  const highlighted = filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function choose(id: string) {
    onChange(id);
    close();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(Math.min(highlighted + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(Math.max(highlighted - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlighted];
      if (option) choose(option.id);
    }
  }

  return (
    <div ref={rootRef} className="relative block space-y-1.5">
      <FieldLabel label={label} optional={optional} />
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          placeholder={placeholder}
          value={open ? query : selectedLabel}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 pr-9 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:bg-slate-50"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No users match this search.</p>
          ) : (
            filtered.map((option, index) => (
              <button
                key={option.id || "empty"}
                type="button"
                role="option"
                aria-selected={option.id === value}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  option.id === value
                    ? "bg-brand/15 text-ink"
                    : index === highlighted
                      ? "bg-[#f7f5f0] text-ink"
                      : "text-slate-700 hover:bg-[#f7f5f0]"
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option.id)}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
