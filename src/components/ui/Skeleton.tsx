import { cn } from "@/lib/utils";

/** Blok placeholder berdenyut untuk loading.tsx. */
export default function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-white/[0.06]", className)} />;
}
