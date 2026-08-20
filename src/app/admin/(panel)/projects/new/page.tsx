import { redirect } from "next/navigation";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import ProjectForm from "./ProjectForm";

export default async function NewProjectPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/projects");

  const supabase = createAdminClient();
  const { data: members } = await supabase
    .from("team_members")
    .select("id, name, role")
    .order("name");

  return (
    <div className="max-w-3xl mx-auto">
      <ProjectForm members={members ?? []} />
    </div>
  );
}
