"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { pialaSop, type SopDocument } from "@/lib/admin/sop";
import { infiniteBookSop } from "@/lib/admin/sop-infinite-book";

const documents = [pialaSop, infiniteBookSop];
const CHECK_EVENT = "sop-produksi-checks-change";
const emptyChecks: Record<string, boolean> = {};

function subscribeChecks(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHECK_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHECK_EVENT, callback);
  };
}

function getServerChecksSnapshot(): string {
  return "";
}

export default function SopClient() {
  const [selectedId, setSelectedId] = useState(pialaSop.id);
  const document = documents.find((item) => item.id === selectedId) ?? pialaSop;

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap gap-2" role="group" aria-label="Pilih SOP produk">
        {documents.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selectedId === item.id}
            onClick={() => setSelectedId(item.id)}
            className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
              selectedId === item.id
                ? "border-[#D97A2B]/40 bg-[#D97A2B]/10 text-[#E9A64E]"
                : "border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <SopDocumentView key={document.id} document={document} />
    </div>
  );
}

function SopDocumentView({ document }: { document: SopDocument }) {
  const {
    meta: sopMeta,
    stages: sopStages,
    rules: weightRules,
    documentationRules,
    socialPlatforms,
    socialRules,
    liveReportItems,
    qcChecklist,
    cleanupChecklist,
    storageKey,
  } = document;

  function getChecksSnapshot(): string {
    try {
      return localStorage.getItem(storageKey) ?? "";
    } catch {
      return "";
    }
  }

  const rawChecks = useSyncExternalStore(
    subscribeChecks,
    getChecksSnapshot,
    getServerChecksSnapshot
  );

  const checks = useMemo(() => {
    if (!rawChecks) return emptyChecks;
    try {
      return JSON.parse(rawChecks) as Record<string, boolean>;
    } catch {
      return emptyChecks;
    }
  }, [rawChecks]);

  function toggle(key: string) {
    const next = { ...checks, [key]: !checks[key] };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(CHECK_EVENT));
  }

  function resetChecks() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      return;
    }
    window.dispatchEvent(new Event(CHECK_EVENT));
  }

  const qcDone = qcChecklist.filter((_, i) => checks[`qc-${i}`]).length;
  const cleanupDone = cleanupChecklist.filter((_, i) => checks[`cleanup-${i}`]).length;

  return (
    <div id="sop-content" className="space-y-8">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #sop-content, #sop-content * { visibility: visible; }
          #sop-content { position: absolute; left: 0; top: 0; width: 100%; background: #fff; color: #111; }
          #sop-content * { color: #111 !important; }
          #sop-content .sop-card { background: #fff !important; border-color: #ddd !important; break-inside: avoid; }
          #sop-content .sop-accent { background: #f3f3f3 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D97A2B]">
            Standar Operasional
          </p>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-white">{sopMeta.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">{sopMeta.subtitle}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/60">
              Versi {sopMeta.version}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/60">
              Berlaku {sopMeta.effectiveDate}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/60">
              Pemilik: {sopMeta.owner}
            </span>
          </div>
        </div>
        <div className="no-print flex shrink-0 gap-2">
          <button
            onClick={resetChecks}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            Reset Centang
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:opacity-90"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Cetak / PDF
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-white/10 bg-[#151515] p-5 md:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">
          Alur Produksi
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {sopStages.map((stage, index) => (
            <div key={stage.code} className="flex items-center gap-2">
              <span className="rounded-lg border border-[#D97A2B]/30 bg-[#D97A2B]/10 px-3 py-1.5 text-xs font-medium text-[#E9A64E]">
                {stage.code} · {stage.name}
              </span>
              {index < sopStages.length - 1 && <span className="text-white/20">→</span>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">
          {document.rulesTitle}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {weightRules.map((rule) => (
            <div
              key={rule.label}
              className="sop-card rounded-xl border border-white/10 bg-[#151515] p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-white/40">
                {rule.label}
              </p>
              <p className="mt-2 text-lg font-bold text-[#E9A64E]">{rule.value}</p>
              <p className="mt-2 text-xs leading-relaxed text-white/50">{rule.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">
            {sopStages.length} Tahap Produksi
          </h2>
          <p className="text-xs text-white/40">
            {document.stageNote}
          </p>
        </div>
        <div className="mt-4 space-y-4">
          {sopStages.map((stage) => (
            <article
              key={stage.code}
              className="sop-card rounded-xl border border-white/10 bg-[#151515] p-5 md:p-6"
            >
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#C44A3A] to-[#D97A2B] font-bold text-white">
                  {stage.code}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">{stage.name}</h3>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/50">
                      PIC: {stage.pic}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-white/50">{stage.purpose}</p>

                  <ol className="mt-4 space-y-1.5 text-sm text-white/70">
                    {stage.steps.map((step, index) => (
                      <li key={index} className="flex gap-2.5">
                        <span className="mt-0.5 shrink-0 text-xs font-semibold text-[#D97A2B]">
                          {stage.code}.{index + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="sop-accent rounded-lg border border-white/5 bg-[#0d0d0d] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        Output
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-white/60">{stage.output}</p>
                    </div>
                    <div className="sop-accent rounded-lg border border-white/5 bg-[#0d0d0d] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        Dokumentasi
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-white/60">{stage.evidence}</p>
                    </div>
                    <div className="sop-accent rounded-lg border border-white/5 bg-[#0d0d0d] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        QC
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-white/60">{stage.qc}</p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="sop-card rounded-xl border border-white/10 bg-[#151515] p-5 md:p-6">
          <h2 className="text-base font-semibold text-white">Upload Web & Arsip Drive</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-white/60">
            {documentationRules.map((rule, index) => (
              <li key={index} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D97A2B]" />
                <span className="leading-relaxed">{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="sop-card rounded-xl border border-white/10 bg-[#151515] p-5 md:p-6">
          <h2 className="text-base font-semibold text-white">Publikasi Media Sosial</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {socialPlatforms.map((item) => (
              <div key={item.platform} className="sop-accent rounded-lg border border-white/5 bg-[#0d0d0d] p-3">
                <p className="text-sm font-semibold text-white">{item.platform}</p>
                <p className="mt-1 text-xs text-[#E9A64E]">{item.format}</p>
              </div>
            ))}
          </div>
          <ul className="mt-4 space-y-2.5 text-sm text-white/60">
            {socialRules.map((rule, index) => (
              <li key={index} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D97A2B]" />
                <span className="leading-relaxed">{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sop-card rounded-xl border border-white/10 bg-[#151515] p-5 md:p-6">
        <h2 className="text-base font-semibold text-white">{document.liveReportTitle}</h2>
        <p className="mt-1 text-sm text-white/50">
          {document.liveReportDescription}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {liveReportItems.map((field) => (
            <span
              key={field}
              className="rounded-lg border border-white/10 bg-[#0d0d0d] px-3 py-1.5 text-xs text-white/60"
            >
              {field}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChecklistCard
          title="Checklist Quality Check"
          subtitle={`${qcDone}/${qcChecklist.length} tercentang`}
          items={qcChecklist}
          prefix="qc"
          checks={checks}
          onToggle={toggle}
        />
        <ChecklistCard
          title="Checklist Clean Up Studio"
          subtitle={`${cleanupDone}/${cleanupChecklist.length} tercentang`}
          items={cleanupChecklist}
          prefix="cleanup"
          checks={checks}
          onToggle={toggle}
        />
      </section>

      <p className="pb-4 text-center text-xs text-white/30">
        {sopMeta.title} · {sopMeta.version} · {sopMeta.owner}
      </p>
    </div>
  );
}

type ChecklistCardProps = {
  title: string;
  subtitle: string;
  items: string[];
  prefix: string;
  checks: Record<string, boolean>;
  onToggle: (key: string) => void;
};

function ChecklistCard({ title, subtitle, items, prefix, checks, onToggle }: ChecklistCardProps) {
  return (
    <div className="sop-card rounded-xl border border-white/10 bg-[#151515] p-5 md:p-6">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/50">
          {subtitle}
        </span>
      </div>
      <ul className="mt-4 space-y-2.5">
        {items.map((item, index) => {
          const key = `${prefix}-${index}`;
          const checked = Boolean(checks[key]);
          return (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(key)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#D97A2B]"
                />
                <span className={checked ? "text-white/35 line-through" : "text-white/70"}>
                  {item}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
