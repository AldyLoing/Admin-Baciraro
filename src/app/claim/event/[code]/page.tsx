"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

function Coin({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth={1.6} />
      <path strokeWidth={1.6} strokeLinecap="round" d="M12 7.5v9M9.5 9.5h3.2a1.8 1.8 0 010 3.6H9.5m0 0h3.6a1.8 1.8 0 010 3.6H9.5" />
    </svg>
  );
}

export default function EventClaimPage() {
  const params = useParams();
  const code = params.code as string;

  const [qr, setQr] = useState<{ event_name: string | null; event_points: number; used: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [customer, setCustomer] = useState<any>(null);
  const [customerLoading, setCustomerLoading] = useState(true);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<{ points: number; total_points: number } | null>(null);
  const [claimError, setClaimError] = useState("");

  const fetchQr = async () => {
    const res = await fetch(`/api/event-qr/${code}`);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setQr(data.qr);
    setLoading(false);
  };

  const fetchMe = async () => {
    const res = await fetch("/api/auth/customer/me");
    const data = await res.json();
    setCustomer(data.customer);
    setCustomerLoading(false);
  };

  useEffect(() => {
    fetchQr();
    fetchMe();
  }, [code]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("");
    setAuthBusy(true);
    const endpoint = mode === "login" ? "/api/auth/customer/login" : "/api/auth/customer/register";
    const body =
      mode === "login"
        ? { email, password }
        : { email, password, name };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setAuthBusy(false);
    if (!res.ok) {
      setAuthMsg(data.error || "Gagal.");
      return;
    }
    setCustomer(data.customer);
    await fetchMe();
  };

  const handleClaim = async () => {
    setClaiming(true);
    setClaimError("");
    const res = await fetch(`/api/event-qr/${code}`, { method: "POST" });
    const data = await res.json();
    setClaiming(false);
    if (!res.ok) {
      setClaimError(data.error || "Gagal klaim.");
      if (res.status === 409 && qr) setQr({ ...qr, used: true });
      return;
    }
    setClaimed({ points: data.points, total_points: data.total_points });
    if (qr) setQr({ ...qr, used: true });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/customer/logout", { method: "POST" });
    setCustomer(null);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0b0b0b] flex items-center justify-center text-white/60">
        Memuat...
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-[#0b0b0b] flex flex-col items-center justify-center text-center text-white px-6">
        <h1 className="text-2xl font-bold">QR Tidak Ditemukan</h1>
        <p className="text-white/50 mt-2">Kode QR event ini tidak valid atau sudah tidak aktif.</p>
      </main>
    );
  }

  const title = qr?.event_name || "Event Baciraro";

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#C44A3A] to-[#D97A2B] flex items-center justify-center text-2xl font-bold mb-4">
            B
          </div>
          <h1 className="text-xl font-bold">{title}</h1>
        </div>

        {claimed ? (
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#C44A3A] to-[#D97A2B] flex items-center justify-center mb-4">
              <Coin className="w-8 h-8 text-white" />
            </div>
            <p className="text-3xl font-bold">+{claimed.points} koin</p>
            <p className="text-white/50 mt-1">Berhasil diklaim!</p>
            <p className="text-white/40 text-sm mt-3">Total koin kamu: {claimed.total_points}</p>
          </div>
        ) : qr?.used ? (
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-lg font-semibold">QR Sudah Terpakai</p>
            <p className="text-white/50 mt-2 text-sm">QR koin ini hanya bisa digunakan sekali.</p>
          </div>
        ) : !customer ? (
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6">
            <p className="text-center text-white/70 mb-4">
              Klaim <span className="font-bold text-[#D97A2B]">{qr?.event_points}</span> koin — login dulu untuk melanjutkan.
            </p>

            <div className="flex gap-2 mb-5">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setAuthMsg(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    mode === m
                      ? "bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white"
                      : "bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  {m === "login" ? "Masuk" : "Daftar"}
                </button>
              ))}
            </div>

            <form onSubmit={handleAuth} className="space-y-3">
              {mode === "register" && (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D97A2B] outline-none"
                  required
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D97A2B] outline-none"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D97A2B] outline-none"
                required
              />
              {authMsg && <p className="text-red-400 text-sm">{authMsg}</p>}
              <button
                type="submit"
                disabled={authBusy}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] font-semibold disabled:opacity-50"
              >
                {authBusy ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar & Lanjut"}
              </button>
            </form>
            <p className="text-white/30 text-xs text-center mt-4">
              Akun Baciraro kamu bisa dipakai di sini.
            </p>
          </div>
        ) : (
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-white/50 text-sm">Halo, {customer.name}</p>
            <p className="text-4xl font-bold my-3 text-[#D97A2B]">+{qr?.event_points} koin</p>
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] font-semibold disabled:opacity-50"
            >
              {claiming ? "Memproses..." : "Klaim Koin"}
            </button>
            {claimError && <p className="text-red-400 text-sm mt-3">{claimError}</p>}
            <button onClick={handleLogout} className="text-white/40 text-xs mt-4 hover:text-white/70">
              Keluar
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
