"use client";

import { usePush } from "@/hooks/usePush";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function PushToggle() {
  const { state, subscribed, loading, subscribe, unsubscribe } = usePush();

  if (state === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        Dein Browser unterstützt keine Push-Benachrichtigungen.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Push-Benachrichtigungen</Label>
          <p className="text-sm text-muted-foreground">
            Erinnerungen für fällige Aufgaben (täglich um 07:00).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <Switch
            checked={subscribed}
            disabled={loading || state === "denied"}
            onCheckedChange={(checked) =>
              checked ? subscribe() : unsubscribe()
            }
          />
        </div>
      </div>
      {state === "denied" && (
        <p className="text-sm text-destructive">
          Benachrichtigungen sind im Browser blockiert. Bitte in den
          Browser-Einstellungen erlauben.
        </p>
      )}
    </div>
  );
}
