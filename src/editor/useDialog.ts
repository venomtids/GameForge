import { useEffect, useRef } from "react";

/** Keyboard focus stays inside the dialog and is restored when it closes. */
export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current;
    const selector =
      'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]';
    const focusables = () =>
      [...(element?.querySelectorAll<HTMLElement>(selector) ?? [])].filter(
        (e) => e.getClientRects().length > 0,
      );
    const timer = setTimeout(
      () =>
        (
          element?.querySelector<HTMLElement>("[data-autofocus]") ??
          focusables()[0] ??
          element
        )?.focus(),
      0,
    );
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        close.current();
      }
      if (e.key !== "Tab") return;
      const elements = focusables(),
        first = elements[0],
        last = elements[elements.length - 1];
      if (!first) {
        e.preventDefault();
        element?.focus();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !element?.contains(document.activeElement))
      ) {
        e.preventDefault();
        last.focus();
      }
      if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !element?.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", key, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  return ref;
}
