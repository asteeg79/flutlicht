// Meldungen (Arena 4 „Toast“): eine Warteschlange, gezeigt wird immer die älteste,
// jede für 2,8 s. So gehen zwei Meldungen nacheinander (Deal + Kapitänswechsel) nicht unter.

export type ToastKind = "info" | "error";
export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export const TOAST_MS = 2800;

export function createToastStore(
  schedule: (fn: () => void, ms: number) => unknown = setTimeout,
) {
  let queue: ToastItem[] = [];
  let nextId = 1;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  function dismiss(id: number) {
    const wasCurrent = queue[0]?.id === id;
    queue = queue.filter((t) => t.id !== id);
    emit();
    if (wasCurrent) startCurrent();
  }

  function startCurrent() {
    const current = queue[0];
    if (current) schedule(() => dismiss(current.id), TOAST_MS);
  }

  function push(kind: ToastKind, message: string) {
    queue = [...queue, { id: nextId++, kind, message }];
    emit();
    if (queue.length === 1) startCurrent();
  }

  return {
    push,
    dismiss,
    current: (): ToastItem | null => queue[0] ?? null,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
