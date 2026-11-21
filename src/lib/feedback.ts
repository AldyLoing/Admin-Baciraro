// Pengganti window.confirm() dan window.alert().
//   if (!(await confirmDialog("Batalkan transaksi ini? ..."))) return;
//   toast.error("Gagal menyimpan.");
// <FeedbackHost /> (dipasang di layout panel) yang menampilkannya. Bila host belum
// terpasang, otomatis jatuh ke dialog bawaan browser agar tidak ada aksi yang hilang.

export type ConfirmOptions = {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

export type ToastKind = "success" | "error" | "info";

type ConfirmHandler = (opts: ConfirmOptions, resolve: (ok: boolean) => void) => void;
type ToastHandler = (kind: ToastKind, message: string) => void;

let confirmHandler: ConfirmHandler | null = null;
let toastHandler: ToastHandler | null = null;

export function registerFeedbackHost(host: { confirm: ConfirmHandler; toast: ToastHandler }) {
  confirmHandler = host.confirm;
  toastHandler = host.toast;
  return () => {
    if (confirmHandler === host.confirm) confirmHandler = null;
    if (toastHandler === host.toast) toastHandler = null;
  };
}

const DANGER_VERBS = ["Batalkan", "Hapus", "Nonaktifkan", "Cabut", "Arsipkan", "Keluarkan", "Putuskan"];

/** Turunkan judul, isi, label tombol, dan nada dari kalimat konfirmasi lama. */
export function resolveConfirm(opts: ConfirmOptions) {
  const msg = opts.message.trim();
  const q = msg.indexOf("?");
  let title = opts.title;
  let body = msg;
  if (!title) {
    if (q > 0 && q <= 90) {
      title = msg.slice(0, q + 1);
      body = msg.slice(q + 1).trim();
    } else {
      title = "Konfirmasi";
    }
  }
  const verb = msg.split(/[\s?]/)[0] ?? "";
  const danger = opts.tone ? opts.tone === "danger" : DANGER_VERBS.includes(verb);
  const confirmLabel = opts.confirmLabel ?? (verb ? `Ya, ${verb.toLowerCase()}` : "Ya, lanjutkan");
  return {
    title,
    body,
    danger,
    confirmLabel: verb && /^[A-Za-z]+$/.test(verb) ? confirmLabel : "Ya, lanjutkan",
    cancelLabel: opts.cancelLabel ?? "Kembali",
  };
}

export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o: ConfirmOptions = typeof opts === "string" ? { message: opts } : opts;
  if (!confirmHandler) {
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(o.message) : false);
  }
  const handler = confirmHandler;
  return new Promise<boolean>((resolve) => handler(o, resolve));
}

function push(kind: ToastKind, message: string) {
  if (toastHandler) {
    toastHandler(kind, message);
  } else if (typeof window !== "undefined" && kind === "error") {
    window.alert(message);
  }
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};
