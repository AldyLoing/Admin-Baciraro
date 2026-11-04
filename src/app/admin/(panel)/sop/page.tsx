import { requireAdmin } from "@/utils/admin";
import SopClient from "./SopClient";

export const revalidate = 0;

export default async function AdminSopPage() {
  await requireAdmin();
  return <SopClient />;
}
