"use client";
// Speichern beim Server für Markt und Aufstellung: Anzeige „speichert …“/„gespeichert“,
// Fehlermeldung, und bei 409 (veralteter Stand, KONZEPT 7.3) die Seite neu laden.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSaveState } from "@/components/arena/save-pill";
import { toast } from "@/components/arena/toast";
import { callApi } from "@/lib/api-client";

export function useServerSave() {
  const router = useRouter();
  const save = useSaveState();
  const [busy, setBusy] = useState(false);

  /** Sendet und meldet Fehler selbst; null bei Fehlschlag. Wirft nie. */
  async function send<T>(
    url: string,
    method: "POST" | "PUT",
    body: unknown,
    failMessage: string,
  ): Promise<T | null> {
    setBusy(true);
    save.begin();
    try {
      const r = await callApi<T>(url, method, body);
      save.done(r.ok);
      if (r.ok) return r.data;
      toast.error(
        r.error ??
          (r.status === 409 ? "Deine Daten haben sich geändert." : failMessage),
      );
      if (r.status === 409) router.refresh();
      return null;
    } catch {
      // Netz weg: wie ein Fehlschlag behandeln, nichts bleibt hängen.
      save.done(false);
      toast.error(failMessage);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { busy, saveState: save.state, send };
}
