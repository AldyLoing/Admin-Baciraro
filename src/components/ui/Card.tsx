import { cn } from "@/lib/utils";

export default function Card({
  as: Tag = "section",
  className,
  children,
  ...rest
}: {
  as?: "section" | "div" | "article";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("min-w-0 rounded-2xl border border-line bg-surface p-5", className)} {...rest}>
      {children}
    </Tag>
  );
}
