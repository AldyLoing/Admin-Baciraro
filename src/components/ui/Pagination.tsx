"use client";

type Props = {
  page: number;
  totalItems: number;
  perPage: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({ page, totalItems, perPage, onPageChange }: Props) {
  const totalPages = Math.ceil(totalItems / perPage);
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1">
      <p className="text-xs text-white/40">
        Menampilkan {start}–{end} dari {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-white/60 hover:bg-white/5 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="px-2 py-1.5 text-xs text-white/30">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                p === page
                  ? "bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white"
                  : "border border-white/10 text-white/60 hover:bg-white/5"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-white/60 hover:bg-white/5 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
