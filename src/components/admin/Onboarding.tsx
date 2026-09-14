"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type OnboardingItem = {
  id: string;
  label: string;
  href: string;
  done: boolean;
};

const STORAGE_KEY = "baciraro_onboarding";

const defaultItems: Omit<OnboardingItem, "done">[] = [
  { id: "account", label: "Buat Chart of Accounts", href: "/admin/chart-of-accounts" },
  { id: "project", label: "Buat Project Pertama", href: "/admin/projects/new" },
  { id: "transaction", label: "Catat Transaksi Pertama", href: "/admin/transactions" },
  { id: "journal", label: "Buat Jurnal Umum", href: "/admin/journal" },
  { id: "task", label: "Buat Tugas Pertama", href: "/admin/schedule" },
  { id: "meeting", label: "Jadwalkan Rapat", href: "/admin/meetings" },
  { id: "payout", label: "Proses Payout Pertama", href: "/admin/payouts" },
  { id: "member", label: "Lihat Data Anggota", href: "/admin/members" },
];

function getDone(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveDone(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export default function Onboarding() {
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDoneIds(getDone());
    setDismissed(localStorage.getItem("baciraro_onboarding_dismissed") === "1");
    setMounted(true);
  }, []);

  const toggle = (id: string) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveDone(next);
      return next;
    });
  };

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem("baciraro_onboarding_dismissed", "1");
  };

  if (!mounted || dismissed) return null;

  const items: OnboardingItem[] = defaultItems.map((d) => ({
    ...d,
    done: doneIds.has(d.id),
  }));

  const completedCount = items.filter((i) => i.done).length;
  const allDone = completedCount === items.length;

  if (allDone) {
    return (
      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{"\u{1F389}"}</span>
            <div>
              <p className="text-sm font-semibold text-emerald-400">Onboarding selesai!</p>
              <p className="text-xs text-white/50">Kamu sudah memahami semua fitur Baciraro OS.</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-white/30 hover:text-white text-xs">Tutup</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#151515] border border-white/10 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Mulai dari sini</h3>
          <p className="text-xs text-white/40 mt-0.5">{completedCount}/{items.length} selesai</p>
        </div>
        <button onClick={dismiss} className="text-white/30 hover:text-white text-xs">
          Sembunyikan
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/5 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] rounded-full transition-all duration-300"
          style={{ width: `${(completedCount / items.length) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left text-xs transition ${
              item.done
                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                : "bg-white/5 border-white/10 text-white/60 hover:border-white/20 hover:text-white"
            }`}
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
              item.done ? "bg-emerald-500 border-emerald-500" : "border-white/20"
            }`}>
              {item.done && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
