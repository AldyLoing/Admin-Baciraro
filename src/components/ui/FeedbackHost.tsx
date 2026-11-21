"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import Button from "./Button";
import { cn } from "@/lib/utils";
import {
  registerFeedbackHost,
  resolveConfirm,
  type ConfirmOptions,
  type ToastKind,
} from "@/lib/feedback";

type ConfirmState = { opts: ConfirmOptions; resolve: (ok: boolean) => void } | null;
type ToastItem = { id: number; kind: ToastKind; message: string };

const toastStyle: Record<ToastKind, { icon: "check" | "alert"; color: string; border: string }> = {
  success: { icon: "check", color: "text-ok", border: "border-line-2" },
  error: { icon: "alert", color: "text-bad", border: "border-red-900/60" },
  info: { icon: "alert", color: "text-info", border: "border-line-2" },
};

export default function FeedbackHost() {
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    return registerFeedbackHost({
      confirm: (opts, resolve) => {
        lastFocus.current = document.activeElement as HTMLElement | null;
        setConfirmState({ opts, resolve });
      },
      toast: (kind, message) => {
        const id = nextId.current++;
        setToasts((t) => [...t.slice(-3), { id, kind, message }]);
        window.setTimeout(() => dismissToast(id), kind === "error" ? 7000 : 4000);
      },
    });
  }, [dismissToast]);

  const close = useCallback(
    (ok: boolean) => {
      setConfirmState((cur) => {
        cur?.resolve(ok);
        return null;
      });
      lastFocus.current?.focus?.();
    },
    []
  );

  // Fokus awal ke "Kembali" (aman untuk aksi destruktif), Esc membatalkan, Tab berputar di dalam dialog.
  useEffect(() => {
    if (!confirmState) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      } else if (e.key === "Tab") {
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmState, close]);

  const view = confirmState ? resolveConfirm(confirmState.opts) : null;

  return (
    <>
      {confirmState && view && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={view.body ? "confirm-body" : undefined}
            className="w-full max-w-md rounded-2xl border border-line-2 bg-[#18181b] p-6 shadow-2xl"
          >
            <div className="flex gap-4">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  view.danger ? "bg-[#2e1414] text-bad" : "bg-brand-soft text-brand-ink"
                )}
              >
                <Icon name="warning" className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h2 id="confirm-title" className="text-[17px] font-bold text-ink">
                  {view.title}
                </h2>
                {view.body && (
                  <p id="confirm-body" className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-2">
                    {view.body}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <Button variant="secondary" onClick={() => close(false)} ref={cancelRef}>
                {view.cancelLabel}
              </Button>
              <Button variant={view.danger ? "danger" : "primary"} onClick={() => close(true)} ref={confirmRef}>
                {view.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => {
          const s = toastStyle[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              style={{ animation: "toastIn 0.18s ease-out" }}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface-2 py-3 pl-4 pr-2 shadow-xl",
                s.border
              )}
            >
              <span className={cn("mt-0.5 flex", s.color)}>
                <Icon name={s.icon} className="h-5 w-5" strokeWidth={2} />
              </span>
              <p className="min-w-0 flex-1 text-sm text-ink">{t.message}</p>
              <button
                type="button"
                aria-label="Tutup notifikasi"
                onClick={() => dismissToast(t.id)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-2 hover:bg-white/10"
              >
                <Icon name="close" className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
