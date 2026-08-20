import { redirect } from "next/navigation";
import { requireAdmin } from "@/utils/admin";
import Sidebar from "@/components/admin/Sidebar";

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const name = admin.name || admin.username || "Admin";
  const role = admin.role || "Member";
  const isAdmin = admin.is_admin ?? false;
  const avatarUrl = admin.avatar_url ?? null;

  return (
    <div className="min-h-screen bg-[#0b0b0b] flex">
      <Sidebar name={name} role={role} isAdmin={isAdmin} avatarUrl={avatarUrl} />
      <main className="flex-1 min-w-0">
        <div className="p-6 md:p-8 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
