import Link from "next/link";

export const metadata = { title: "Impressum und Datenschutz" };

// Minimalseite laut KONZEPT 15.4, inklusive Nennung der OpenLigaDB (ODbL).
export default function ImprintPage() {
  return (
    <main className="mx-auto max-w-lg space-y-6 px-5 py-10 leading-relaxed">
      <h1 className="font-display text-4xl font-extrabold uppercase">
        Impressum und Datenschutz
      </h1>
      <section className="space-y-2">
        <h2 className="font-semibold">Private Runde</h2>
        <p className="text-muted">
          Diese App ist ein privates, nicht kommerzielles Spiel einer
          geschlossenen Freundesrunde. Zugang gibt es nur mit Einladungscode.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Gespeicherte Daten</h2>
        <p className="text-muted">
          Wir speichern E-Mail-Adresse, Anzeigename, Teamname, einen Hash deines
          Passworts, deinen Kader samt Aufstellungen und, falls du sie
          einschaltest, deine Push-Anmeldung. Die Daten liegen verschlüsselt.
          Dein Konto löscht der Admin auf Wunsch vollständig.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Datenquellen</h2>
        <p className="text-muted">
          Spielplandaten: OpenLigaDB (ODbL). Spielerdaten und Bewertungen werden
          nur für diese Runde verwendet und nicht weitergegeben.
        </p>
      </section>
      <Link
        href="/login"
        className="text-sm text-text underline-offset-4 hover:underline"
      >
        Zurück
      </Link>
    </main>
  );
}
