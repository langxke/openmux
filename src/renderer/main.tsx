import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { OpenMuxProvider } from "./hooks/useOpenMux";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OpenMuxProvider api={window.openmux}>
      <App />
    </OpenMuxProvider>
  </StrictMode>,
);
