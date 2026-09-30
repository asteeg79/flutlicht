import Link from "next/link";
import { HeroHeader } from "@/components/arena/hero-header";
import { PageBody } from "@/components/arena/page-layout";
import { ThemePicker } from "@/components/arena/theme-picker";
import { ProfileSettings } from "@/components/profile-settings";
import { PushSettings } from "@/components/push-settings";
import { signOut } from "@/lib/auth";
import { currentManager } from "@/lib/session";
import { APP_COMMIT, APP_VERSION, formatVersion } from "@/lib/version";

export const metadata = { title: "Einstellungen" };

async function logout() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

const H2 = "mb-2 font-display text-2xl font-black uppercase";

export default async function SettingsPage() {
  const manager = await currentManager();
  return (
    <>
      <HeroHeader title="Optionen" compact={{ title: "Optionen" }}>
        <p className="text-[13px] font-semibold text-hero-muted">
          {manager.displayName} · {manager.teamName}
        </p>
      </HeroHeader>
      <PageBody>
        <div className="flex flex-col gap-5 lg:max-w-[720px]">
          <section>
            <h2 className={H2}>Konto</h2>
            <ProfileSettings
              email={manager.email}
              initial={{
                displayName: manager.displayName,
                teamName: manager.teamName,
              }}
            />
          </section>
          <section>
            <h2 className={H2}>Darstellung</h2>
            <ThemePicker />
          </section>
          <section>
            <h2 className={H2}>Benachrichtigungen</h2>
            <PushSettings initialPrefs={manager.push?.prefs ?? null} />
          </section>
          <section className="flex flex-col gap-1">
            <form action={logout} className="mb-2.5">
              <button
                type="submit"
                className="h-[50px] w-full border-2 border-text font-display text-xl font-black uppercase"
              >
                Abmelden
              </button>
            </form>
            {manager.role === "admin" ? (
              <Link
                href="/admin"
                className="inline-flex min-h-11 items-center self-start text-[13px] font-semibold text-accent underline-offset-4 hover:underline"
              >
                Admin
              </Link>
            ) : null}
            <Link
              href="/impressum"
              className="inline-flex min-h-11 items-center self-start text-[13px] font-semibold text-muted underline-offset-4 hover:underline"
            >
              Impressum und Datenschutz
            </Link>
            <p className="text-[11px] font-medium text-muted opacity-80">
              Version {formatVersion(APP_VERSION)} · {APP_COMMIT} · gebaut{" "}
              {process.env.NEXT_PUBLIC_BUILD_DATE}
            </p>
          </section>
        </div>
      </PageBody>
    </>
  );
}
