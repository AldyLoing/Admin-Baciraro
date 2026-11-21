"use client";

import Link from "next/link";
import Button, { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

// Ditampilkan bila halaman panel gagal dimuat (mis. koneksi database terputus).
export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#2e1414] text-bad">
        <Icon name="warning" className="h-6 w-6" strokeWidth={2} />
      </span>
      <h1 className="text-xl font-bold text-ink">Halaman gagal dimuat</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Terjadi gangguan saat mengambil data. Coba muat ulang; bila masih gagal, hubungi admin.
      </p>
      {error.digest && <p className="mt-2 text-xs text-ink-3">Kode: {error.digest}</p>}
      <div className="mt-6 flex gap-2.5">
        <Button variant="primary" onClick={reset}>
          Coba lagi
        </Button>
        <Link href="/admin" className={buttonClass("secondary")}>
          Ke Dashboard
        </Link>
      </div>
    </div>
  );
}
