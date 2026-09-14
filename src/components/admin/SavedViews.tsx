"use client";

import { useState, useEffect } from "react";

export type SavedView = {
  id: string;
  name: string;
  page: string;
  filters: Record<string, string>;
  createdAt: string;
};

type Props = {
  page: string;
  currentFilters: Record<string, string>;
  onLoad: (filters: Record<string, string>) => void;
};

const STORAGE_KEY = "baciraro_saved_views";

function getAll(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAll(views: SavedView[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

export default function SavedViews({ page, currentFilters, onLoad }: Props) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [viewName, setViewName] = useState("");

  useEffect(() => {
    setViews(getAll().filter((v) => v.page === page));
  }, [page]);

  const save = () => {
    if (!viewName.trim()) return;
    const newView: SavedView = {
      id: Date.now().toString(),
      name: viewName.trim(),
      page,
      filters: { ...currentFilters },
      createdAt: new Date().toISOString(),
    };
    const all = getAll();
    all.push(newView);
    saveAll(all);
    setViews((prev) => [...prev, newView]);
    setViewName("");
    setShowInput(false);
  };

  const remove = (id: string) => {
    const all = getAll().filter((v) => v.id !== id);
    saveAll(all);
    setViews((prev) => prev.filter((v) => v.id !== id));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {views.map((v) => (
        <div key={v.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs group">
          <button
            onClick={() => onLoad(v.filters)}
            className="text-white/70 hover:text-white transition"
          >
            {v.name}
          </button>
          <button
            onClick={() => remove(v.id)}
            className="text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {showInput ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setShowInput(false);
            }}
            placeholder="Nama view..."
            className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none w-32 placeholder:text-white/30"
          />
          <button onClick={save} className="text-emerald-400 hover:text-emerald-300 text-xs">
            Simpan
          </button>
          <button onClick={() => setShowInput(false)} className="text-white/40 hover:text-white text-xs">
            Batal
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-white/10 text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Simpan View
        </button>
      )}
    </div>
  );
}
