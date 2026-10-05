import { createTheme, type MantineColorsTuple } from "@mantine/core";

// Brand palette — DESIGN.md "Colors". Only the primary color needs a full
// 10-shade Mantine tuple (required by Mantine's color system); accent and the
// four status colors are intentionally flat single-value tokens (DESIGN.md
// specifies exactly one background/foreground pair each, not a shade scale),
// exposed below via `theme.other` instead of as Mantine named colors.
const brandBlue: MantineColorsTuple = [
  "#EAF2F8",
  "#D1E3F0",
  "#A3C7E1",
  "#75ABD2",
  "#4A8FC2", // primary-dark (DESIGN.md) — used automatically in dark mode
  "#2E73A5",
  "#1C5D8C", // primary (DESIGN.md) — used automatically in light mode
  "#174E76",
  "#123E5F",
  "#0D2F49",
];

export const theme = createTheme({
  primaryColor: "brandBlue",
  colors: { brandBlue },
  primaryShade: { light: 6, dark: 4 },

  fontFamily: "Heebo, system-ui, sans-serif",
  headings: { fontFamily: "Heebo, system-ui, sans-serif" },

  defaultRadius: "md",
  radius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
  },

  // Flat design tokens that aren't Mantine color-shade scales — accent is
  // reserved exclusively for "needs attention" (DESIGN.md), never decoration.
  // Status colors back the future StatusBadge component (UX-DR2).
  other: {
    accent: "#B8791A",
    accentForeground: "#1A1208", // dark text on accent — white fails WCAG AA here (~3.6:1)
    statusActive: "#2F7D46",
    statusActiveForeground: "#FFFFFF",
    statusInactive: "#6B7280",
    statusInactiveForeground: "#FFFFFF",
    statusPending: "#B8791A",
    statusPendingForeground: "#1A1208",
    statusRejected: "#B3261E",
    statusRejectedForeground: "#FFFFFF",
    radiusPill: "999px",
  },
});
