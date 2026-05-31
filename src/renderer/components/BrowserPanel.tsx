import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { glaze } from "../lib/glaze-api";

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          preload?: string;
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
  setZoomLevel(level: number): void;
  addEventListener(
    type: "dom-ready" | "did-finish-load" | "ipc-message" | "page-title-updated",
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: "dom-ready" | "did-finish-load" | "ipc-message" | "page-title-updated",
    listener: EventListener,
    options?: boolean | EventListenerOptions,
  ): void;
}

interface IpcMessageEvent extends Event {
  channel: string;
  args: unknown[];
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
  const initialUrl = params.initialUrl ?? "https://www.google.com";
  const [inputValue, setInputValue] = useState(initialUrl);
  const [preloadPath, setPreloadPath] = useState<string | null>(null);

  useEffect(() => {
    glaze().getWebviewPreloadPath().then(setPreloadPath);
  }, []);

  const applyZoom = useCallback(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    try {
      wv.setZoomLevel(zoomRef.current);
    } catch {
      // not ready
    }
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
      if (e.key === "Enter") navigate();
    },
    [navigate],
  );

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const onIpcMessage = (e: Event) => {
      const msg = e as IpcMessageEvent;
      if (msg.channel === "zoom" && typeof msg.args[0] === "number") {
        zoomRef.current = msg.args[0];
        applyZoom();
      }
    };

    const onTitleUpdated = (e: Event) => {
      const event = e as unknown as { title: string };
      if (event.title) api.setTitle(event.title);
    };

    const onReady = () => {
      applyZoom();
    };

    wv.addEventListener("dom-ready", onReady);
    wv.addEventListener("did-finish-load", onReady);
    wv.addEventListener("ipc-message", onIpcMessage);
    wv.addEventListener("page-title-updated", onTitleUpdated as EventListener);

    return () => {
      wv.removeEventListener("dom-ready", onReady);
      wv.removeEventListener("did-finish-load", onReady);
      wv.removeEventListener("ipc-message", onIpcMessage);
      wv.removeEventListener("page-title-updated", onTitleUpdated as EventListener);
    };
  }, [applyZoom, preloadPath, api]);

  return (
    <div className="h-full w-full flex flex-col bg-white">
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
      {preloadPath ? (
        <webview
          ref={webviewRef}
          preload={preloadPath}
          src={initialUrl}
          className="flex-1 w-full"
        />
      ) : (
        <div className="flex-1 w-full bg-white" />
      )}
    </div>
  );
}
