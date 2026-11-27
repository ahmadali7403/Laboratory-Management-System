"use client";

import { useEffect, useRef } from "react";

/**
 * Shared POS keyboard controller implementing F1-F10, Ctrl+Delete, Ctrl+Z, and Esc
 * consistently across Pharmacy POS and Laboratory POS.
 */
export function usePosKeyboard(handlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    function onKeyDown(e) {
      const h = ref.current;
      const modalOpen = Boolean(document.querySelector('[role="dialog"]'));

      if (e.key === "F1") {
        // Handled globally by KeyboardNav
        return;
      }

      if (modalOpen) {
        if (e.key === "Escape") {
          return; // Let active Modal handle Escape
        }
        return;
      }

      if (e.key === "F2") {
        e.preventDefault();
        h.onNewSale?.();
      } else if (e.key === "F3") {
        e.preventDefault();
        h.onFocusSearch?.();
      } else if (e.key === "F4") {
        e.preventDefault();
        h.onFocusCustomer?.();
      } else if (e.key === "F5") {
        e.preventDefault();
        h.onHoldOrResume?.();
      } else if (e.key === "F6") {
        e.preventDefault();
        h.onFocusDiscount?.();
      } else if (e.key === "F8") {
        e.preventDefault();
        h.onCycleMethod?.();
      } else if (e.key === "F9") {
        e.preventDefault();
        h.onSaveAndPrint?.();
      } else if (e.key === "F10") {
        e.preventDefault();
        h.onSaveOnly?.();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        h.onSaveOnly?.();
      } else if (e.key === "Delete" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        h.onRemoveSelected?.();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const active = document.activeElement;
        const isTyping =
          active &&
          (active.tagName === "TEXTAREA" ||
            (active.tagName === "INPUT" && active.value?.length > 0 && active.dataset?.posSearch !== "true"));
        if (!isTyping) {
          e.preventDefault();
          h.onUndo?.();
        }
      } else if (e.key === "Escape") {
        h.onEscape?.(e);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
