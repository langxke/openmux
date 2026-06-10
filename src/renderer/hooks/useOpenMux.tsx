import { createContext, useContext } from "react";
import type { OpenMuxAPI } from "./useOpenMux.types";

export type { OpenMuxAPI } from "./useOpenMux.types";

const OpenMuxContext = createContext<OpenMuxAPI | null>(null);

interface OpenMuxProviderProps {
  api: OpenMuxAPI;
  children: React.ReactNode;
}

export function OpenMuxProvider({ api, children }: OpenMuxProviderProps) {
  return (
    <OpenMuxContext.Provider value={api}>{children}</OpenMuxContext.Provider>
  );
}

/**
 * Access the openmux IPC API via React Context.
 *
 * In production, the root <OpenMuxProvider> is wired to window.openmux.
 * In tests, wrap your component with a mock <OpenMuxProvider> and inject
 * a stubbed API — no Electron or global patching required.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useOpenMux(): OpenMuxAPI {
  const api = useContext(OpenMuxContext);
  if (!api) {
    throw new Error(
      "useOpenMux() must be used within an <OpenMuxProvider> — " +
        "wrap your app root with <OpenMuxProvider api={window.openmux}>",
    );
  }
  return api;
}
