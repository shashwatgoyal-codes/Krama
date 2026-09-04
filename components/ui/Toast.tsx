"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Brief confirmation, top centre.
 *
 * For the actions whose result has nowhere else to live: the row you
 * suspended, the capture you filed, the device you signed out. Those all
 * remove the thing you were looking at, so an inline message would
 * disappear with it and you would be left wondering whether the click
 * registered.
 *
 * Deliberately *not* a replacement for inline errors. A rejected field
 * belongs beside that field, where the fix is — a validation message
 * that floats at the top of the screen makes you hunt for what it meant.
 * Toasts confirm; forms explain.
 */

export type Tone = "success" | "error";

type Toast = { id: number; tone: Tone; message: string };

type ToastApi = {
  /** Confirm something that worked. */
  success: (message: string) => void;
  /** Report something that did not, when there is no field to put it beside. */
  error: (message: string) => void;
};

const Ctx = createContext<ToastApi | null>(null);

/**
 * Errors linger. Four seconds is enough to register "Saved", and not
 * enough to read a sentence explaining what went wrong and decide what
 * to do about it.
 */
const LIFETIME: Record<Tone, number> = { success: 4000, error: 8000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = (nextId.current += 1);
      setToasts((all) => [...all, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), LIFETIME[tone]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

/**
 * Throws when used outside the provider rather than returning a no-op.
 * A toast that silently does nothing is worse than a crash in
 * development, because you only discover it when somebody needed the
 * confirmation and did not get one.
 */
export function useToast(): ToastApi {
  const api = useContext(Ctx);
  if (!api) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }
  return api;
}

function ToastRegion({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      // pointer-events-none on the container, auto on each toast, so this
      // never swallows a click on whatever is underneath it.
      className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Next frame, so the entry transition has a state to move from.
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const error = toast.tone === "error";

  return (
    <div
      // Errors announce immediately; confirmations wait their turn rather
      // than interrupting whatever a screen reader is already saying.
      role={error ? "alert" : "status"}
      className={
        "pointer-events-auto flex max-w-[440px] items-start gap-2.5 rounded-lg border px-3.5 py-2.5 " +
        "shadow-lg transition-all duration-200 motion-reduce:transition-none " +
        (shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0") +
        (error
          ? " border-bad bg-bad-soft text-bad"
          : " border-ok bg-ok-soft text-ok")
      }
    >
      <span className="text-[12.5px] font-medium leading-snug">
        {toast.message}
      </span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="-mr-1 ml-auto flex-none rounded px-1 text-[13px] leading-none opacity-60 transition-opacity hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
