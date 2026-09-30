"use client";

import type { InviteCode } from "@fm/core";
import { useState } from "react";
import { toast } from "@/components/arena/toast";
import { adminCall, Section, SmallButton } from "@/components/admin/common";

export interface ManagerRow {
  userId: string;
  displayName: string;
  teamName: string;
  email: string;
  role: "admin" | "player";
  firstMatchday: number;
  hasSquad: boolean;
}

/** Einladungscodes erzeugen und widerrufen (KONZEPT 11). */
export function Invites({
  initial,
  names,
}: {
  initial: InviteCode[];
  names: Record<string, string>;
}) {
  const [invites, setInvites] = useState(initial);
  const open = invites.filter((i) => !i.usedBy && !i.revoked);
  const used = invites.filter((i) => i.usedBy);

  async function create() {
    const r = await adminCall<{ code: string }>("/api/admin/invites", "POST");
    if (!r) return;
    setInvites([
      ...invites,
      { code: r.code, createdAt: new Date().toISOString() },
    ]);
    toast.success(`Neuer Einladungscode: ${r.code}`);
  }
  async function revoke(code: string) {
    if (!(await adminCall("/api/admin/invites", "DELETE", { code }))) return;
    setInvites(
      invites.map((i) => (i.code === code ? { ...i, revoked: true } : i)),
    );
  }

  return (
    <Section id="einladungen" title="Einladungen">
      <SmallButton variant="primary" onClick={create}>
        Neuen Code erzeugen
      </SmallButton>
      <ul className="mt-3 space-y-2">
        {open.map((i) => (
          <li key={i.code} className="flex items-center justify-between gap-3">
            <code className="font-display text-2xl tracking-widest text-accent">
              {i.code}
            </code>
            <SmallButton onClick={() => revoke(i.code)}>Widerrufen</SmallButton>
          </li>
        ))}
        {open.length === 0 ? (
          <li className="text-sm text-muted">Kein offener Code.</li>
        ) : null}
      </ul>
      {used.length > 0 ? (
        <p className="mt-3 text-xs text-muted">
          Eingelöst:{" "}
          {used
            .map((i) => `${i.code} (${names[i.usedBy!] ?? "gelöscht"})`)
            .join(", ")}
        </p>
      ) : null}
    </Section>
  );
}

/** Reset-Code erzeugen, Konto löschen (KONZEPT 11, 15.4). */
export function Managers({
  initial,
  selfId,
}: {
  initial: ManagerRow[];
  selfId: string;
}) {
  const [managers, setManagers] = useState(initial);
  const [resetCodes, setResetCodes] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function reset(userId: string) {
    const r = await adminCall<{ code: string }>("/api/admin/reset", "POST", {
      userId,
    });
    if (r) setResetCodes({ ...resetCodes, [userId]: r.code });
  }
  async function remove(userId: string) {
    if (confirmDelete !== userId) return setConfirmDelete(userId);
    if (!(await adminCall("/api/admin/managers", "DELETE", { userId }))) return;
    setManagers(managers.filter((m) => m.userId !== userId));
    setConfirmDelete(null);
    toast.success("Konto gelöscht.");
  }

  return (
    <Section id="manager" title="Manager">
      <ul className="divide-y divide-line">
        {managers.map((m) => (
          <li key={m.userId} className="py-3">
            <p className="font-semibold">
              {m.displayName}{" "}
              <span className="text-sm font-normal text-muted">
                {m.teamName}
              </span>
            </p>
            <p className="text-xs text-muted">
              {m.email} · {m.role === "admin" ? "Admin" : "Spieler"} · ab
              Spieltag {m.firstMatchday}
              {m.hasSquad ? "" : " · noch kein Kader"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SmallButton onClick={() => reset(m.userId)}>
                Reset-Code
              </SmallButton>
              {m.userId !== selfId ? (
                <SmallButton variant="danger" onClick={() => remove(m.userId)}>
                  {confirmDelete === m.userId
                    ? "Wirklich löschen?"
                    : "Konto löschen"}
                </SmallButton>
              ) : null}
              {resetCodes[m.userId] ? (
                <span className="text-sm">
                  Code{" "}
                  <code className="font-display text-xl tracking-widest text-accent">
                    {resetCodes[m.userId]}
                  </code>{" "}
                  (24 h gültig)
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
