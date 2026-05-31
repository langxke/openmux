import { useState, useCallback, useRef } from "react";

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { src?: string },
        HTMLElement
      >;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

interface WebviewElement extends HTMLElement {
  loadURL(url: string): void;
  getURL(): string;
  reload(): void;
  goBack(): void;
  goForward(): void;
}

export function BrowserPanel({
  params,
}: {
  params: { initialUrl?: string };
  api: { isActive: boolean };
}) {
  const webviewRef = useRef<WebviewElement>(null);
  const initialUrl = params.initialUrl ?? "https://www.google.com";
  const [inputValue, setInputValue] = useState(initialUrl);

  const navigate = useCallback(
    (url?: string) => {
      let target = (url ?? inputValue).trim();
      if (!target) return;
      if (!/^https?:\/\//i.test(target)) {
        target = `https://${target}`;
      }
      setInputValue(target);
      webviewRef.current?.loadURL(target);
    },
    [inputValue],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") navigate();
    },
    [navigate],
  );

  return (
    <div className="h-full w-full flex flex-col bg-white">
      <div
        className="flex items-center gap-1 px-2 py-1 border-b shrink-0"
        style={{ borderColor: "var(--color-border, #e5e5e5)" }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2 py-0.5 text-sm rounded outline-none"
          style={{
            backgroundColor: "var(--color-bg-secondary, #f5f5f5)",
            color: "var(--color-text, #1d1d1f)",
          }}
          placeholder="Enter URL..."
        />
        <button
          onClick={() => navigate()}
          className="px-2 py-0.5 text-sm rounded cursor-pointer"
          style={{
            backgroundColor: "var(--color-accent, #007aff)",
            color: "#fff",
          }}
        >
          Go
        </button>
      </div>
      <webview ref={webviewRef} src={initialUrl} className="flex-1 w-full" />
    </div>
  );
}
