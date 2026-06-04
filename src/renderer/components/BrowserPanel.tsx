import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { om } from "../lib/openmux-api";

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          preload?: string;
          partition?: string;
        },
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
  setZoomFactor(factor: number): void;
  addEventListener(
    type: "dom-ready" | "did-finish-load" | "page-title-updated" | "did-navigate" | "did-navigate-in-page" | "new-window",
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: "dom-ready" | "did-finish-load" | "page-title-updated" | "did-navigate" | "did-navigate-in-page" | "new-window",
    listener: EventListener,
    options?: boolean | EventListenerOptions,
  ): void;
}

export function BrowserPanel({
  params,
  api,
}: {
  params: { initialUrl?: string };
  api: import("dockview").DockviewPanelApi;
}) {
  const webviewRef = useRef<WebviewElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const zoomRef = useRef(0);
  const initialUrl = params.initialUrl ?? "https://www.bing.com";
  const [inputValue, setInputValue] = useState(initialUrl);
  const [preloadPath, setPreloadPath] = useState<string | null>(null);

  // Unique partition per browser panel isolates zoom/cookies/cache per webview
  const partition = useMemo(() => `browser-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, []);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    om().getWebviewPreloadPath().then((p) => {
      setPreloadPath(p);
      setReady(true);
    });
  }, []);

  const applyZoom = useCallback((level?: number) => {
    const wv = webviewRef.current;
    if (!wv) return;
    const lvl = level ?? zoomRef.current;
    wv.setZoomFactor(Math.pow(1.2, lvl));
  }, []);

  const navigate = useCallback(
    (url?: string) => {
      let target = (url ?? inputValue).trim();
      if (!target) return;
      if (!/^https?:\/\//i.test(target)) {
        target = `https://${target}`;
      }
      setInputValue(target);
      webviewRef.current?.loadURL(target);
      inputRef.current?.blur();
    },
    [inputValue],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        navigate();
      } else if (e.ctrlKey && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        e.stopPropagation();
        zoomRef.current = Math.min(5, zoomRef.current + 0.5);
        applyZoom();
      } else if (e.ctrlKey && e.key === "-") {
        e.preventDefault();
        e.stopPropagation();
        zoomRef.current = Math.max(-5, zoomRef.current - 0.5);
        applyZoom();
      } else if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        e.stopPropagation();
        zoomRef.current = 0;
        applyZoom();
      }
    },
    [navigate, applyZoom],
  );

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const onTitleUpdated = (e: Event) => {
      const event = e as unknown as { title: string };
      if (event.title) api.setTitle(event.title);
    };

    const onNavigate = (e: Event) => {
      const url = (e as unknown as { url: string }).url;
      if (url && url !== "about:blank") {
        setInputValue(url);
        api.updateParameters({ initialUrl: url });
      }
    };

    wv.addEventListener("page-title-updated", onTitleUpdated as EventListener);
    wv.addEventListener("did-navigate", onNavigate);
    wv.addEventListener("did-navigate-in-page", onNavigate);

    return () => {
      wv.removeEventListener("page-title-updated", onTitleUpdated as EventListener);
      wv.removeEventListener("did-navigate", onNavigate);
      wv.removeEventListener("did-navigate-in-page", onNavigate);
    };
  }, [api, ready, preloadPath]);

  return (
    <div className="h-full w-full flex flex-col bg-white" data-browser-panel="">
      <div
        className="flex items-center gap-0.5 px-1 py-1 border-b shrink-0"
        style={{ borderColor: "var(--color-border, #e5e5e5)" }}
      >
        <button
          onClick={() => webviewRef.current?.goBack()}
          className="w-6 h-6 flex items-center justify-center rounded cursor-pointer"
          style={{ color: "var(--color-text-dim)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-dim)")}
          title="后退"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
        </button>
        <button
          onClick={() => webviewRef.current?.goForward()}
          className="w-6 h-6 flex items-center justify-center rounded cursor-pointer"
          style={{ color: "var(--color-text-dim)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-dim)")}
          title="前进"
        >
          <ArrowRight size={14} strokeWidth={1.5} />
        </button>
        <button
          onClick={() => webviewRef.current?.reload()}
          className="w-6 h-6 flex items-center justify-center rounded cursor-pointer"
          style={{ color: "var(--color-text-dim)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-dim)")}
          title="刷新"
        >
          <RefreshCw size={14} strokeWidth={1.5} />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onDragStart={(e) => e.preventDefault()}
          className="flex-1 px-2 py-0.5 text-xs rounded outline-none"
          style={{
            marginLeft: 8,
            backgroundColor: "#ffffff",
            color: "var(--color-text, #1d1d1f)",
          }}
          placeholder="Enter URL..."
        />
      </div>
      {ready && preloadPath ? (
        <webview
          ref={webviewRef}
          preload={preloadPath}
          src={initialUrl}
          partition={partition}
          // @ts-expect-error Electron webview attribute
          allowpopups="true"
          className="flex-1 w-full"
        />
      ) : (
        <div className="flex-1 w-full bg-white" />
      )}
    </div>
  );
}
