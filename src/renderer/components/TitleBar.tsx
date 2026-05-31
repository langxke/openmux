import { useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { glaze } from "../lib/glaze-api";

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    glaze()
      .window.isMaximized()
      .then(setMaximized);
    const dispose = glaze().window.onMaximizeChange(setMaximized);
    return dispose;
  }, []);

  return (
    <div
      className="flex items-center shrink-0 select-none"
      style={{
        height: 28,
        backgroundColor: "var(--color-sidebar)",
        borderBottom: "1px solid var(--color-border)",
        WebkitAppRegion: "drag",
      } as React.CSSProperties}
    >
      <span
        className="pl-3 text-xs font-medium"
        style={{ color: "var(--color-text-dim)", fontSize: 11 }}
      >
        Glaze
      </span>

      <div className="flex-1" />

      <div
        className="flex h-full"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          onClick={() => glaze().window.minimize()}
          className="w-11 h-full flex items-center justify-center hover:bg-black/10 transition-colors"
          title="最小化"
        >
          <Minus size={14} strokeWidth={1.5} />
        </button>
        <button
          onClick={() => glaze().window.maximize()}
          className="w-11 h-full flex items-center justify-center hover:bg-black/10 transition-colors"
          title={maximized ? "还原" : "最大化"}
        >
          {maximized ? (
            <Copy size={14} strokeWidth={1.5} />
          ) : (
            <Square size={14} strokeWidth={1.5} />
          )}
        </button>
        <button
          onClick={() => glaze().window.close()}
          className="w-11 h-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
          title="关闭"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
