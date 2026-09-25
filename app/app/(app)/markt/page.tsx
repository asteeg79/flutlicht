import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Markt" };

export default function MarketPage() {
  return (
    <>
      <PageHeader title="Markt" />
      <p className="text-kreide-matt">
        Der Transfermarkt wird gerade gebaut und öffnet mit dem nächsten Update.
      </p>
    </>
  );
}
