import { describe, expect, it } from "vitest";
import { createToastStore, TOAST_MS } from "@/components/arena/toast-store";

function setup() {
  const timers: { fn: () => void; ms: number }[] = [];
  const store = createToastStore((fn, ms) => timers.push({ fn, ms }));
  return { store, timers };
}

describe("Toast-Warteschlange", () => {
  it("zeigt Meldungen nacheinander, jede 2,8 s", () => {
    const { store, timers } = setup();
    store.push("info", "Deal!");
    store.push("info", "Kane ist jetzt Kapitän.");
    expect(store.current()?.message).toBe("Deal!");
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBe(TOAST_MS);

    timers[0]!.fn();
    expect(store.current()?.message).toBe("Kane ist jetzt Kapitän.");
    timers[1]!.fn();
    expect(store.current()).toBeNull();
  });

  it("Antippen schließt sofort und startet die nächste", () => {
    const { store, timers } = setup();
    store.push("error", "Fehler");
    store.push("info", "Weiter");
    store.dismiss(store.current()!.id);
    expect(store.current()).toMatchObject({ kind: "info", message: "Weiter" });
    expect(timers).toHaveLength(2);
  });

  it("höchstens eine wartet, ein Fehler erscheint sofort", () => {
    const { store, timers } = setup();
    store.push("info", "a");
    store.push("info", "b");
    store.push("info", "c");
    timers[0]!.fn();
    expect(store.current()?.message).toBe("c");
    store.push("error", "Speichern fehlgeschlagen");
    expect(store.current()).toMatchObject({ kind: "error" });
    // Der alte Zeitgeber von „c“ schließt den Fehler nicht vorzeitig.
    timers[1]!.fn();
    expect(store.current()).toMatchObject({ kind: "error" });
  });

  it("benachrichtigt Abonnenten", () => {
    const { store } = setup();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.push("info", "a");
    off();
    store.push("info", "b");
    expect(calls).toBe(1);
  });
});
