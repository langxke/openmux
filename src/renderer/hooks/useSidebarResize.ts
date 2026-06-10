import { useCallback, type RefObject } from "react";
import { useSidebarStore } from "../stores/sidebarStore";

const MIN_WIDTH = 120;
const MAX_WIDTH = 480;

interface UseSidebarResizeOptions {
  sidebarRef: RefObject<HTMLElement | null>;
  onPersist: () => void;
}

export function useSidebarResize({ sidebarRef, onPersist }: UseSidebarResizeOptions) {
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = useSidebarStore.getState().width;
      const el = sidebarRef.current;

      useSidebarStore.getState().setIsResizing(true);

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(startWidth + delta)));
        if (el) {
          el.style.width = `${w}px`;
        }
      };

      const handleMouseUp = () => {
        const finalWidth = el ? parseInt(el.style.width, 10) : startWidth;
        useSidebarStore.getState().setWidth(finalWidth || startWidth);
        useSidebarStore.getState().setIsResizing(false);
        onPersist();
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [sidebarRef, onPersist],
  );

  return { handleResizeStart };
}
