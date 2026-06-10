import { useCallback, useEffect } from "react";
import { useSidebarStore } from "../stores/sidebarStore";
import { useZoomStore } from "../stores/zoomStore";
import type { useWorkspaces } from "./useWorkspaces";

type CreateWorkspaceFn = ReturnType<typeof useWorkspaces>["createWorkspace"];

function isTerminalFocused(): boolean {
  const el = document.activeElement;
  return !!(el && el.closest(".xterm"));
}

function isInBrowserPanel(): boolean {
  const el = document.activeElement;
  return !!(el && (el.closest("webview") || el.closest("[data-browser-panel]")));
}

interface UseKeyboardShortcutsOptions {
  createWorkspace: CreateWorkspaceFn;
}

export function useKeyboardShortcuts({ createWorkspace }: UseKeyboardShortcutsOptions) {
  const toggleSidebar = useSidebarStore((s) => s.toggle);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      } else if (e.ctrlKey && e.shiftKey && e.key === "N") {
        e.preventDefault();
        createWorkspace();
      } else if (e.ctrlKey && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        if (isTerminalFocused()) {
          useZoomStore.getState().zoomTerminalIn();
        } else if (!isInBrowserPanel()) {
          useZoomStore.getState().zoomIn();
        }
      } else if (e.ctrlKey && e.key === "-") {
        e.preventDefault();
        if (isTerminalFocused()) {
          useZoomStore.getState().zoomTerminalOut();
        } else if (!isInBrowserPanel()) {
          useZoomStore.getState().zoomOut();
        }
      } else if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        if (isTerminalFocused()) {
          useZoomStore.getState().zoomTerminalReset();
        } else if (!isInBrowserPanel()) {
          useZoomStore.getState().zoomReset();
        }
      }
    },
    [toggleSidebar, createWorkspace],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
