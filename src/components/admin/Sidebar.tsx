"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import Icon, { type IconName } from "@/components/ui/Icon";
import LogoutButton from "./LogoutButton";
import ChangePasswordModal from "./ChangePasswordModal";

type NavItem = { href: string; label: string; icon: IconName };
type NavSection = { title: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    title: "Ringkasan",
    items: [
      { href: "/admin", label: "Dashboard", icon: "dash" },
      { href: "/admin/reports", label: "Laporan", icon: "report" },
    ],
  },
  {
    title: "Pekerjaan",
    items: [
      { href: "/admin/projects", label: "Projects", icon: "folder" },
      { href: "/admin/schedule", label: "Jadwal & Tugas", icon: "cal" },
      { href: "/admin/workload", label: "Workload", icon: "pulse" },
      { href: "/admin/meetings", label: "Rapat & Tindak Lanjut", icon: "chat" },
      { href: "/admin/sop", label: "SOP Produksi", icon: "sop" },
    ],
  },
  {
    title: "Keuangan",
    items: [
      { href: "/admin/transactions", label: "Kas & Transaksi", icon: "wallet" },
      { href: "/admin/payouts", label: "Payouts", icon: "coin" },
      { href: "/admin/journal", label: "Jurnal Umum", icon: "book" },
      { href: "/admin/bookkeeping", label: "Buku Besar", icon: "ledger" },
      { href: "/admin/accounts", label: "Daftar Akun", icon: "list" },
    ],
  },
  {
    title: "Inventori",
    items: [{ href: "/admin/inventori", label: "Barang & Stok", icon: "box" }],
  },
  {
    title: "Tim & Komunitas",
    items: [
      { href: "/admin/members", label: "Anggota", icon: "users" },
      { href: "/admin/leaderboard", label: "Leaderboard", icon: "trophy" },
      { href: "/admin/qr-event", label: "QR Koin Event", icon: "qr" },
    ],
  },
  {
    title: "Sistem",
    items: [
      { href: "/admin/notifications", label: "Notifikasi", icon: "bell" },
      { href: "/admin/templates", label: "Template", icon: "copy" },
      { href: "/admin/activity", label: "Log Aktivitas", icon: "history" },
    ],
  },
];

type SidebarProps = {
  name: string;
  role: string;
  isAdmin: boolean;
  avatarUrl?: string | null;
};

export default function Sidebar({ name, role, isAdmin, avatarUrl }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  useEffect(() => {
    const fetchNotif = () => {
      fetch("/api/admin/notifications")
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setUnreadCount(d.unread_count ?? 0);
        })
        .catch(() => {});
    };
    fetchNotif();
    const timer = setInterval(fetchNotif, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-xl bg-surface border border-line text-ink-2 hover:text-ink transition"
        aria-label="Buka menu"
        aria-expanded={mobileOpen}
      >
        <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "w-64 shrink-0 bg-surface border-r border-line text-ink flex flex-col min-h-screen sticky top-0 transition-transform duration-300 z-50",
          "max-md:fixed max-md:inset-y-0 max-md:left-0",
          mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"
        )}
      >
        <div className="p-5 border-b border-line">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-brand text-on-brand flex items-center justify-center font-extrabold text-[17px]">
                B
              </div>
              <div>
                <p className="font-bold leading-tight">Baciraro</p>
                <p className="text-xs text-ink-3">Operating System</p>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:text-ink transition"
              aria-label="Tutup menu"
            >
              <Icon name="close" className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        <nav aria-label="Menu utama" className="flex-1 overflow-y-auto p-3 space-y-4">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 mb-1.5 text-xs font-semibold text-ink-3">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                        active
                          ? "bg-brand-soft text-brand-ink font-semibold"
                          : "text-[#c4c4cc] hover:bg-white/5 hover:text-ink"
                      )}
                    >
                      <Icon name={item.icon} className="w-[18px] h-[18px]" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.href === "/admin/notifications" && unreadCount > 0 && (
                        <span
                          className="ml-auto min-w-[20px] rounded-full bg-brand px-1.5 text-center text-xs font-bold leading-5 text-on-brand"
                          aria-label={`${unreadCount} belum dibaca`}
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-line">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-full bg-brand-soft text-brand-ink overflow-hidden flex items-center justify-center text-sm font-bold">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                name.charAt(0)
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{name}</p>
              <p className="text-xs text-ink-3 truncate">
                {role}
                {isAdmin ? " · Admin" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowChangePassword(true)}
            className="w-full flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium text-ink-2 hover:text-ink hover:bg-white/5 transition mb-1"
          >
            <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Ganti Password
          </button>
          <LogoutButton />
        </div>
        {showChangePassword && (
          <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
        )}
      </aside>
    </>
  );
}
