import type { Config } from "tailwindcss";

/**
 * Tailwind v4 reads most config from CSS (@theme) — see packages/ui/src/styles.css.
 * This file just lists content paths so JIT picks up classes from workspace packages.
 */
export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
} satisfies Config;
