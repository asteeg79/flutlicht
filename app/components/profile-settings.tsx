"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SavePill, useSaveState } from "@/components/arena/save-pill";
import { toast } from "@/components/arena/toast";
import { callApi } from "@/lib/api-client";

interface Profile {
  displayName: string;
  teamName: string;
}

const MAX = 40;

/**
 * Konto in den Optionen: Anzeige- und Teamname sind änderbar, die E-Mail nicht.
 * Nach dem Speichern lädt der Server-Rahmen neu (Seitenleiste, Köpfe, Tabelle).
 */
export function ProfileSettings({
  email,
  initial,
}: {
  email: string;
  initial: Profile;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = useSaveState();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = {
      displayName: draft.displayName.trim(),
      teamName: draft.teamName.trim(),
    };
    if (
      next.displayName === profile.displayName &&
      next.teamName === profile.teamName
    ) {
      setEditing(false);
      return;
    }
    setBusy(true);
    save.begin();
    const r = await callApi<Profile>("/api/me", "PUT", next);
    setBusy(false);
    save.done(r.ok);
    if (!r.ok) {
      toast.error(r.error ?? "Speichern hat nicht geklappt.");
      return;
    }
    setProfile(r.data);
    setEditing(false);
    toast("Gespeichert – so sehen dich jetzt alle.");
    router.refresh();
  }

  const row = "flex justify-between gap-3 py-2.5 text-sm";
  const input =
    "h-12 w-full border-2 border-line bg-bg px-3.5 text-base font-medium text-text focus:border-lampe focus:outline-none";

  if (!editing)
    return (
      <div data-testid="profile" className="bg-surface px-3.5 py-1">
        <dl>
          <div className={row}>
            <dt className="text-muted">Anzeigename</dt>
            <dd className="truncate font-semibold">{profile.displayName}</dd>
          </div>
          <div className={`${row} border-t border-line`}>
            <dt className="text-muted">E-Mail</dt>
            <dd className="truncate font-semibold">{email}</dd>
          </div>
          <div className={`${row} border-t border-line`}>
            <dt className="text-muted">Team</dt>
            <dd className="truncate font-semibold">{profile.teamName}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => {
            setDraft(profile);
            setEditing(true);
          }}
          className="mt-1 mb-3 h-11 border-2 border-line px-3.5 font-display text-base font-black uppercase"
        >
          Namen ändern
        </button>
        <SavePill state={save.state} />
      </div>
    );

  return (
    <form
      onSubmit={submit}
      aria-label="Namen ändern"
      className="flex flex-col gap-3.5 bg-surface p-3.5"
    >
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Anzeigename
        <input
          name="displayName"
          value={draft.displayName}
          onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
          maxLength={MAX}
          autoComplete="nickname"
          required
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Teamname
        <input
          name="teamName"
          value={draft.teamName}
          onChange={(e) => setDraft({ ...draft, teamName: e.target.value })}
          maxLength={MAX}
          required
          className={input}
        />
      </label>
      <p className="text-xs text-muted">
        Höchstens {MAX} Zeichen. Die anderen sehen die neuen Namen sofort, auch
        in der Tabelle und bei vergangenen Spieltagen.
      </p>
      <div className="grid grid-cols-[1fr_1.4fr] gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="h-12 border-2 border-line font-display text-lg font-black uppercase"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={busy}
          className="slant h-12 bg-lampe font-display text-lg font-black text-nacht uppercase disabled:opacity-60"
        >
          Speichern
        </button>
      </div>
      <SavePill state={save.state} />
    </form>
  );
}
