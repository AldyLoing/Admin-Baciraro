"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type Result = {
  type: string;
  id: number;
  label: string;
  sub: string;
  href: string;
};

const quickActions = [
  { label: "+ Tambah Project", href: "/admin/projects/new" },
  { label: "+ Catat Pengeluaran", href: "/admin/transactions" },
  { label: "+ Catat Pemasukan", href: "/admin/transactions" },
  { label: "+ Buat Tugas", href: "/admin/schedule" },
  { label: "+ Buat Rapat", href: "/admin/meetings" },
];

const typeLabels: Record<string, string> = {
  project: "Projects",
  member: "Anggota",
  transaction: "Transaksi",
  task: "Tugas",
  meeting: "Rapat",
  payout: "Payouts",
};

const typeColors: Record<string, string> = {
  project: "text-emerald-400",
  member: "text-blue-400",
  transaction: "text-amber-400",
  task: "text-purple-400",
  meeting: "text-pink-400",
  payout: "text-green-400",
};

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const showPanel = focused;

  // ⌘K / Ctrl+K → focus input
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && focused) {
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [focused]);

  // Click outside → blur
  useEffect(() => {
    if (!showPanel) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        inputRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPanel]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setError(false);
      setLoading(false);
      setSelectedIndex(-1);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      fetch(`/api/admin/search?q=${encodeURIComponent(query)}`)
        .then((r) => {
          if (!r.ok) throw new Error("Search failed");
          return r.json();
        })
        .then((d) => {
          if (cancelled) return;
          setResults(d.results || []);
          setError(false);
          setSelectedIndex(-1);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const navigate = useCallback(
    (href: string) => {
      setQuery("");
      setFocused(false);
      inputRef.current?.blur();
      router.push(href);
    },
    [router]
  );

  const showQuick = focused && query.length < 2;
  const showResults = focused && query.length >= 2;
  const items = showQuick ? quickActions : showResults ? results : [];
  const totalItems = items.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0) {
        if (showQuick) {
          navigate(quickActions[selectedIndex].href);
        } else if (showResults && results[selectedIndex]) {
          navigate(results[selectedIndex].href);
        }
      }
    }
  };

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
    (acc[r.type] ||= []).push(r);
    return acc;
  }, {});

  const showBackdrop = showPanel;

  return (
    <>
      <div ref={wrapperRef} className="relative mb-6 z-10">
        {/* Search input */}
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setFocused(true);
              setSelectedIndex(-1);
            }}
            onBlur={() => {
              // Delay so click on results can fire first
              setTimeout(() => {
                if (!wrapperRef.current?.contains(document.activeElement)) {
                  setFocused(false);
                }
              }, 150);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Cari project, transaksi, anggota..."
            className="w-full pl-12 pr-14 py-3 rounded-xl bg-[#151515] border border-white/10 text-white text-sm outline-none focus:border-white/30 transition placeholder:text-white/30"
            aria-label="Cari"
          />
          <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-white/20 border border-white/10 rounded px-1.5 py-0.5 pointer-events-none">
            ⌘K
          </kbd>
        </div>

        {/* Panel */}
        {showPanel && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#111111] rounded-xl border border-white/10 shadow-2xl overflow-hidden z-50">
            {/* Content */}
            <div className="max-h-[340px] overflow-y-auto p-2">
              {showQuick ? (
                <div>
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                    Quick Actions
                  </p>
                  {quickActions.map((a, i) => (
                    <button
                      key={a.label}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        navigate(a.href);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition ${
                        i === selectedIndex
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-xs">
                        +
                      </span>
                      {a.label.replace("+ ", "")}
                    </button>
                  ))}
                </div>
              ) : loading ? (
                <p className="text-center py-8 text-white/40 text-sm">Mencari...</p>
              ) : error ? (
                <p className="text-center py-8 text-red-400 text-sm">Gagal mengambil data. Coba lagi.</p>
              ) : results.length === 0 ? (
                <p className="text-center py-8 text-white/40 text-sm">
                  Tidak ada hasil untuk &quot;{query}&quot;
                </p>
              ) : (
                Object.entries(grouped).map(([type, typeItems]) => (
                  <div key={type}>
                    <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                      {typeLabels[type] || type}
                    </p>
                    {typeItems.map((item) => {
                      const idx = results.indexOf(item);
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            navigate(item.href);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition ${
                            idx === selectedIndex
                              ? "bg-white/10 text-white"
                              : "text-white/70 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-xs font-medium ${
                              typeColors[item.type] || "text-white/50"
                            }`}
                          >
                            {item.type.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{item.label}</p>
                            <p className="truncate text-xs text-white/40">{item.sub}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/10 text-[10px] text-white/30">
              <span>
                <kbd className="border border-white/10 rounded px-1">↑↓</kbd> navigasi
              </span>
              <span>
                <kbd className="border border-white/10 rounded px-1">↵</kbd> buka
              </span>
              <span>
                <kbd className="border border-white/10 rounded px-1">esc</kbd> tutup
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Backdrop — dim background when panel is open */}
      {showBackdrop && (
        <div
          className="fixed inset-0 z-[5] bg-black/20"
          onMouseDown={() => inputRef.current?.blur()}
        />
      )}
    </>
  );
}
