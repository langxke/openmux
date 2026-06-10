import { useEffect, type RefObject } from "react";

/**
 * Focus and select an input element when editing mode is entered.
 *
 * Uses rAF + setTimeout(0) to ensure the input is in the DOM before
 * we try to focus — without this race, the input never gets focus,
 * onBlur never fires, and the user sees no cursor (can only backspace,
 * not type new text).
 */
export function useRenameInput(ref: RefObject<HTMLInputElement | null>, editing: boolean): void {
  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          ref.current?.focus();
          ref.current?.select();
        }, 0);
      });
    }
  }, [editing, ref]);
}
