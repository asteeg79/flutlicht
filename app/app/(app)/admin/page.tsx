import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Admin" />
      <p className="text-kreide-matt">
        Einladungscodes, Reset-Codes und Nachträge kommen hierher.
      </p>
    </>
  );
}
