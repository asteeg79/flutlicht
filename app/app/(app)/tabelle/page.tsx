import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Tabelle" };

export default function StandingsPage() {
  return (
    <>
      <PageHeader title="Tabelle" />
      <p className="text-kreide-matt">
        Die Tabelle erscheint, sobald der erste gewertete Spieltag gespielt ist.
      </p>
    </>
  );
}
