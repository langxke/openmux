import { ipcRenderer } from "electron";

let zoomLevel = 0;

console.log("[glaze-webview] preload loaded");

function sendZoom(level: number) {
  console.log("[glaze-webview] sendToHost zoom", level);
  ipcRenderer.sendToHost("zoom", level);
}

window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (!e.ctrlKey) return;

  console.log("[glaze-webview] keydown", e.key, e.ctrlKey);

  if (e.key === "=" || e.key === "+") {
    e.preventDefault();
    zoomLevel = Math.min(5, zoomLevel + 0.5);
    sendZoom(zoomLevel);
  } else if (e.key === "-") {
    e.preventDefault();
    zoomLevel = Math.max(-5, zoomLevel - 0.5);
    sendZoom(zoomLevel);
  } else if (e.key === "0") {
    e.preventDefault();
    zoomLevel = 0;
    sendZoom(zoomLevel);
  }
});
