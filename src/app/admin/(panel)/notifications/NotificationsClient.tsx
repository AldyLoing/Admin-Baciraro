"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/admin/format";

type Notification = {
  id: string | number;
  type: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

type Props = {
  notifications: Notification[];
  unreadCount: number;
  userId: number;
};

const typeIcon: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-400",
  success: "bg-emerald-500/10 text-emerald-400",
  warning: "bg-orange-500/10 text-orange-400",
  error: "bg-red-500/10 text-red-400",
};

export default function NotificationsClient({ notifications: initial, unreadCount: initialUnread, userId }: Props) {
  const [notifications, setNotifications] = useState(initial);
  const [unreadCount, setUnreadCount] = useState(initialUnread);

  async function markAllRead() {
    const res = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string | number) {
    const res = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function remove(id: string | number) {
    const res = await fetch("/api/admin/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return;
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.is_read) setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Notifikasi</h1>
          <p className="text-white/50 mt-1">
            {unreadCount > 0
              ? `Anda memiliki ${unreadCount} notifikasi belum dibaca.`
              : "Semua notifikasi sudah dibaca."}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm font-medium hover:bg-white/5 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Tandai Semua Sudah Dibaca
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Total</p>
          <p className="text-xl font-bold text-white mt-1">{notifications.length}</p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Belum Dibaca</p>
          <p className="text-xl font-bold text-orange-400 mt-1">{unreadCount}</p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Sudah Dibaca</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{notifications.length - unreadCount}</p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-[#151515] rounded-xl border border-dashed border-white/20 p-16 text-center text-white/40">
          <svg className="w-12 h-12 mx-auto mb-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-lg font-medium mb-1">Tidak ada notifikasi</p>
          <p className="text-sm">Notifikasi baru akan muncul di sini.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`bg-[#151515] rounded-xl border border-white/10 p-4 flex items-start gap-4 transition ${
                !n.is_read ? "border-l-2 border-l-[#D97A2B]" : ""
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeIcon[n.type] ?? typeIcon.info}`}>
                {n.type === "success" ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : n.type === "warning" ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                ) : n.type === "error" ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!n.is_read ? "text-white font-medium" : "text-white/70"}`}>
                  {n.message}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-white/40">{formatDateTime(n.created_at)}</span>
                  {n.link && (
                    <Link href={n.link} className="text-xs text-[#E9A64E] hover:underline">
                      Lihat →
                    </Link>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!n.is_read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="p-1.5 text-white/30 hover:text-emerald-400 transition"
                    aria-label="Tandai sudah dibaca"
                    title="Tandai sudah dibaca"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => remove(n.id)}
                  className="p-1.5 text-white/30 hover:text-red-400 transition"
                  aria-label="Hapus notifikasi"
                  title="Hapus"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
