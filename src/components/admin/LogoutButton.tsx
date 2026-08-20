"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function LogoutButton() {
  const router = useRouter();
  const { logoutAdmin } = useAdminAuth();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await logoutAdmin();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      Keluar
    </button>
  );
}
