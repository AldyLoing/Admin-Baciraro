import { cn } from "@/lib/utils";

export type BadgeTone = "blue" | "amber" | "green" | "red" | "purple" | "orange" | "gray";

const tones: Record<BadgeTone, string> = {
  blue: "bg-[#0f1d33] text-info",
  amber: "bg-[#2b220c] text-warn",
  green: "bg-[#0f2a1a] text-ok",
  red: "bg-[#2e1414] text-bad",
  purple: "bg-[#1e1a33] text-[#c4b5fd]",
  orange: "bg-brand-soft text-brand-ink",
  gray: "bg-[#1f1f23] text-[#c4c4cc]",
};

export default function Badge({
  tone = "gray",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
