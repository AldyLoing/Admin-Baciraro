import { redirect } from "next/navigation";
import { requireAdmin } from "@/utils/admin";
import Sidebar from "@/components/admin/Sidebar";
import SearchBar from "@/components/admin/SearchBar";
import FeedbackHost from "@/components/ui/FeedbackHost";

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
    <div className="min-h-screen bg-canvas flex">
      <FeedbackHost />
      <Sidebar name={name} role={role} isAdmin={isAdmin} avatarUrl={avatarUrl} />
      <main className="flex-1 min-w-0">
        <div className="p-4 md:p-6 lg:p-10 pt-14 md:pt-6">
          <SearchBar />
          {children}
        </div>
      </main>
    </div>
  );
}
