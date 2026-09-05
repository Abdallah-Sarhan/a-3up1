import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "@/router";

// Standalone entry for the Electron build. CSS is emitted once as a normal
// local stylesheet; keeping an 80 KB style string out of React avoids a large
// synchronous DOM update while Windows is activating its text-input service.
const router = getRouter();
const root = document.getElementById("root");

if (!root) throw new Error("Ward 39 root element was not found");

if (window.ward39Desktop) {
  document.documentElement.classList.add("ward39-desktop");
  window.ward39Desktop.recordInteraction("application mounted");
  window.addEventListener("focusin", (event) => {
    const target = event.target;
    const kind = target instanceof HTMLElement ? target.tagName.toLowerCase() : "unknown";
    window.ward39Desktop?.recordInteraction(`focus ${kind}`);
  });
  window.addEventListener("compositionstart", () => window.ward39Desktop?.recordInteraction("composition start"));
  window.addEventListener("compositionend", () => window.ward39Desktop?.recordInteraction("composition end"));
  window.setInterval(() => window.ward39Desktop?.heartbeat("application"), 1000);
}

window.addEventListener("error", (event) => {
  window.ward39Desktop?.reportError(`renderer error: ${event.message}`);
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  window.ward39Desktop?.reportError(`unhandled rejection: ${reason}`);
});

createRoot(root).render(<RouterProvider router={router} />);
