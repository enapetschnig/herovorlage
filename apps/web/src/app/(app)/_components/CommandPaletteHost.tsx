"use client";
import { useEffect, useState } from "react";
import { CommandPalette } from "./CommandPalette";

/**
 * Mount once in the app shell. Listens for Cmd/Ctrl+K and the custom
 * `heatflow:open-palette` event (so the TopBar search button can dispatch it).
 */
export function CommandPaletteHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onCustom() { setOpen(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener("heatflow:open-palette", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("heatflow:open-palette", onCustom);
    };
  }, []);

  return <CommandPalette open={open} onClose={() => setOpen(false)} />;
}
