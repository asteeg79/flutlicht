import { PageHeader } from "@/components/page-header";
import { formatMio } from "@fm/core";
import { currentManager } from "@/lib/session";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const manager = await currentManager();
  return (
    <>
      <PageHeader
        context={`Gewertet ab Spieltag ${manager.firstMatchday}`}
        title={manager.teamName}
      />
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-nacht-linie bg-nacht-hoch p-4">
          <dt className="text-xs text-kreide-matt">Guthaben</dt>
          <dd className="font-display text-3xl font-bold tabular-nums">
            {formatMio(manager.cash)}
          </dd>
        </div>
        <div className="rounded-xl border border-nacht-linie bg-nacht-hoch p-4">
          <dt className="text-xs text-kreide-matt">Kader</dt>
          <dd className="font-display text-3xl font-bold tabular-nums">
            {manager.squad.length} / 15
          </dd>
        </div>
      </dl>
      {manager.squad.length === 0 ? (
        <p className="mt-6 text-kreide-matt">
          Dein Kader ist noch leer. Sobald der Markt öffnet, stellst du dort
          deine 15 Spieler zusammen.
        </p>
      ) : null}
    </>
  );
}
