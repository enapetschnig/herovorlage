"use client";
import { useEffect, useState } from "react";
import { AssistantPanel } from "./AssistantPanel";

/**
 * Mounts the FlowAI Assistant panel once in the app shell. Listens for:
 * - Cmd/Ctrl + . to toggle
 * - Custom event `heatflow:open-assistant` (TopBar Sparkles button dispatches it)
 */
export function AssistantHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onCustom() { setOpen(true); }
    function onCloseEvt() { setOpen(false); }
    window.addEventListener("keydown", onKey);
    window.addEventListener("heatflow:open-assistant", onCustom);
    window.addEventListener("heatflow:close-assistant", onCloseEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("heatflow:open-assistant", onCustom);
      window.removeEventListener("heatflow:close-assistant", onCloseEvt);
    };
  }, []);

  return <AssistantPanel open={open} onClose={() => setOpen(false)} />;
}
