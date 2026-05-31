import { useState, useRef, useCallback, useMemo } from "react";
import type { CustomCommand } from "../lib/types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CustomCommand[];
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const onMountRef = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    el?.focus();
  }, []);

  const filtered = useMemo(
    () =>
      commands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(query.toLowerCase()) ||
          cmd.command.toLowerCase().includes(query.toLowerCase()),
      ),
    [commands, query],
  );

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(0);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIndex]) {
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered, selectedIndex, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
      onClick={onClose}
    >
      <div
        className="w-[560px] rounded-lg shadow-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--color-bg)",
          border: "1px solid var(--color-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center px-4 py-3 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <span style={{ color: "var(--color-text-dim)" }} className="mr-2">
            &gt;
          </span>
          <input
            ref={onMountRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder="输入命令名称..."
            className="flex-1 bg-transparent outline-none text-sm font-mono"
            style={{ color: "var(--color-text)" }}
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div
              className="px-4 py-6 text-center text-sm"
              style={{ color: "var(--color-text-dim)" }}
            >
              无匹配命令
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.name}
                className="px-4 py-2.5 flex items-center justify-between cursor-pointer text-sm"
                style={{
                  backgroundColor:
                    i === selectedIndex
                      ? "var(--color-accent-bg)"
                      : "transparent",
                  color:
                    i === selectedIndex
                      ? "var(--color-accent)"
                      : "var(--color-text)",
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => onClose()}
              >
                <span>{cmd.name}</span>
                <span
                  className="text-xs font-mono"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  {cmd.command}
                </span>
              </div>
            ))
          )}
        </div>

        <div
          className="px-4 py-2 border-t text-xs flex gap-4"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-text-dim)",
          }}
        >
          <span>↑↓ 导航</span>
          <span>Enter 执行</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  );
}
