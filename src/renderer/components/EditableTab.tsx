import { useState, useRef, useCallback, useEffect } from "react";
import type { IDockviewDefaultTabProps } from "dockview";
import { useRenameInput } from "../hooks/useRenameInput";

export function EditableTab(props: IDockviewDefaultTabProps) {
  const { api, containerApi: _containerApi, hideClose, closeActionOverride } = props;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Track title changes (mirrors dockview's useTitle hook)
  const [title, setTitle] = useState(api.title);
  useEffect(() => {
    const disposable = api.onDidTitleChange((event) => {
      setTitle(event.title);
    });
    if (title !== api.title) {
      setTitle(api.title);
    }
    return () => disposable.dispose();
  }, [api]);

  useRenameInput(inputRef, editing);

  const commit = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== title) {
      api.setTitle(trimmed);
    }
    setEditing(false);
  }, [name, api, title]);

  const cancel = useCallback(() => {
    setEditing(false);
  }, []);

  // Close handler matching dockview's default behavior
  const onClose = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (closeActionOverride) {
        closeActionOverride();
      } else {
        api.close();
      }
    },
    [api, closeActionOverride],
  );

  const onBtnPointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
  }, []);

  if (editing) {
    return (
      <div className="dv-default-tab" style={{ padding: "0 8px" }}>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--color-text)",
            fontSize: 12,
            fontFamily: "inherit",
            width: "100%",
            borderBottom: "2px solid var(--color-accent)",
            padding: "1px 0",
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="dv-default-tab"
      onDoubleClick={() => {
        setEditing(true);
        setName(title ?? "");
      }}
    >
      <span className="dv-default-tab-content">{title}</span>
      {!hideClose && (
        <div className="dv-default-tab-action" onPointerDown={onBtnPointerDown} onClick={onClose}>
          <svg height="8" width="8" viewBox="0 0 28 28" aria-hidden="false" focusable={false} className="dv-svg">
            <path d="M2.1 27.3L0 25.2L11.55 13.65L0 2.1L2.1 0L13.65 11.55L25.2 0L27.3 2.1L15.75 13.65L27.3 25.2L25.2 27.3L13.65 15.75L2.1 27.3Z" />
          </svg>
        </div>
      )}
    </div>
  );
}
