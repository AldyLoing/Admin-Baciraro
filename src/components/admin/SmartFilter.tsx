"use client";

import { useState } from "react";

export type FilterField = {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "amount";
  options?: { value: string; label: string }[];
  placeholder?: string;
};

type FilterValues = Record<string, string>;

type Props = {
  fields: FilterField[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onReset?: () => void;
};

export default function SmartFilter({ fields, values, onChange, onReset }: Props) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = Object.values(values).filter((v) => v !== "").length;

  const updateField = (key: string, value: string) => {
    onChange({ ...values, [key]: value });
  };

  const reset = () => {
    const empty: FilterValues = {};
    fields.forEach((f) => (empty[f.key] = ""));
    onChange(empty);
    onReset?.();
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filter
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#D97A2B] text-white rounded-full">
              {activeCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <button
            onClick={reset}
            className="px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition"
          >
            Reset
          </button>
        )}

        {/* Active filter chips */}
        {fields.map((field) => {
          const val = values[field.key];
          if (!val) return null;
          const label = field.type === "select"
            ? field.options?.find((o) => o.value === val)?.label || val
            : val;
          return (
            <span
              key={field.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70"
            >
              {field.label}: {label}
              <button onClick={() => updateField(field.key, "")} className="text-white/40 hover:text-white">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          );
        })}
      </div>

      {/* Expanded filter panel */}
      {expanded && (
        <div className="mt-3 p-4 rounded-lg bg-[#151515] border border-white/10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs text-white/50 mb-1">{field.label}</label>
              {field.type === "select" ? (
                <select
                  value={values[field.key] || ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-white/20 transition"
                >
                  <option value="">Semua</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : field.type === "date" ? (
                <input
                  type="date"
                  value={values[field.key] || ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-white/20 transition"
                />
              ) : (
                <input
                  type="text"
                  value={values[field.key] || ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder || ""}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-white/20 transition placeholder:text-white/30"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
