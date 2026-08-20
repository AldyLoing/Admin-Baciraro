"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function AdminLoginPage() {
  const router = useRouter();
  const { loginAdmin } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Email wajib diisi.");
      return;
    }
    setLoading(true);

    const res = await loginAdmin(email.trim(), password);
    setLoading(false);

    if (res.error) {
      setError("Email atau password salah. Coba lagi.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070707] px-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#D97A2B]/10 rounded-full blur-3xl -translate-y-32 translate-x-32" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#C44A3A]/10 rounded-full blur-3xl translate-y-32 -translate-x-32" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-[#141414] border border-white/10 rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C44A3A] to-[#D97A2B] flex items-center justify-center mb-4 shadow-lg shadow-orange-500/20">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Baciraro</h1>
            <p className="text-sm text-white/50 mt-1">Masuk untuk mengelola panel admin</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="baciraro@gmail.com"
                className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] focus:ring-2 focus:ring-[#D97A2B]/20 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] focus:ring-2 focus:ring-[#D97A2B]/20 outline-none transition"
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white font-semibold shadow-lg shadow-orange-500/20 hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10">
            <a href="/" className="text-sm text-white/50 hover:text-[#E9A64E] transition flex items-center justify-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Kembali ke website
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
