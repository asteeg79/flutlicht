import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PushSettings } from "@/components/push-settings";
import { APP_COMMIT, APP_VERSION, formatVersion } from "@/lib/version";
import { Button } from "@/components/ui";
import { signOut } from "@/lib/auth";
import { currentManager } from "@/lib/session";

export const metadata = { title: "Einstellungen" };

async function logout() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function SettingsPage() {
  const manager = await currentManager();
  return (
    <>
      <PageHeader title="Einstellungen" />
      <section className="mb-8 rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-muted">Konto</h2>
        <dl className="space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Anzeigename</dt>
            <dd>{manager.displayName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">E-Mail</dt>
            <dd className="truncate">{manager.email}</dd>
          </div>
        </dl>
      </section>
      <PushSettings initialPrefs={manager.push?.prefs ?? null} />
      <form action={logout} className="mb-8">
        <Button type="submit" variant="secondary">
          Abmelden
        </Button>
      </form>
      <nav className="flex flex-col gap-3 text-sm">
        {manager.role === "admin" ? (
          <Link
            href="/admin"
            className="text-accent underline-offset-4 hover:underline"
          >
            Admin
          </Link>
        ) : null}
        <Link
          href="/impressum"
          className="text-muted underline-offset-4 hover:underline"
        >
          Impressum und Datenschutz
        </Link>
        <p className="text-xs text-muted/70">
          Version {formatVersion(APP_VERSION)} · {APP_COMMIT} · gebaut{" "}
          {process.env.NEXT_PUBLIC_BUILD_DATE}
        </p>
      </nav>
    </>
  );
}
