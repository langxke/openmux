import { useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { useOpenMux } from "../hooks/useOpenMux";

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const om = useOpenMux();

  useEffect(() => {
    om.window.isMaximized().then(setMaximized);
    const dispose = om.window.onMaximizeChange(setMaximized);
    return dispose;
  }, [om.window]);

  return (
    <div
      className="flex items-center shrink-0 select-none"
      style={{
        height: 28,
        borderBottom: "1px solid var(--color-border)",
        WebkitAppRegion: "drag",
      } as React.CSSProperties}
    >
      <div className="flex-1" />

      <div
        className="flex h-full"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          onClick={() => om.window.minimize()}
          className="w-11 h-full flex items-center justify-center hover:bg-black/10 transition-colors"
          title="最小化"
        >
          <Minus size={14} strokeWidth={1.5} />
        </button>
        <button
          onClick={() => om.window.maximize()}
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
          onClick={() => om.window.close()}
          className="w-11 h-full flex items-center justify-center transition-colors"
          title="关闭"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-red)";
            (e.currentTarget as HTMLElement).style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.color = "";
          }}
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
