// ── Elemetric Design System ───────────────────────────────────────────────────
// Single source of truth for all visual tokens.
// Import and use these instead of hard-coding values in StyleSheet.create().

// Colors
export const BG       = "#07152b";   // screen background
export const CARD     = "#0f2035";   // card / input background
export const BORDER   = "rgba(255,255,255,0.07)";  // subtle card border
export const ORANGE   = "#f97316";   // primary brand / CTA
export const GREEN    = "#22c55e";   // success / pass
export const RED      = "#ef4444";   // error / fail
export const BLUE     = "#3b82f6";   // info / assigned

// Text
export const TEXT     = "#ffffff";
export const TEXT2    = "rgba(255,255,255,0.55)";
export const TEXT3    = "rgba(255,255,255,0.35)";

// Spacing
export const PAD      = 20;   // screen edge padding
export const GAP      = 12;   // gap between cards
export const GAP_LG   = 20;   // gap between sections

// Typography
export const T_TITLE   = { fontSize: 22, fontWeight: "900" as const, color: TEXT };
export const T_SECTION = { fontSize: 11, fontWeight: "800" as const, color: TEXT3, letterSpacing: 1 };
export const T_BODY    = { fontSize: 15, fontWeight: "400" as const, color: TEXT };
export const T_BODY_B  = { fontSize: 15, fontWeight: "700" as const, color: TEXT };
export const T_CAPTION = { fontSize: 13, fontWeight: "400" as const, color: TEXT2 };
export const T_SMALL   = { fontSize: 12, fontWeight: "500" as const, color: TEXT3 };

// Shared component shapes
export const CARD_STYLE = {
  backgroundColor: CARD,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: BORDER,
  padding: 16,
} as const;

export const BTN_PRIMARY = {
  backgroundColor: ORANGE,
  borderRadius: 14,
  height: 56,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 20,
} as const;

export const BTN_SECONDARY = {
  backgroundColor: "rgba(255,255,255,0.06)",
  borderRadius: 14,
  height: 52,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 20,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
} as const;

export const BTN_GHOST = {
  borderRadius: 14,
  height: 52,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 20,
} as const;

// Screen container
export const SCREEN_STYLE = {
  flex: 1,
  backgroundColor: BG,
} as const;

export const CONTENT_STYLE = {
  padding: PAD,
  paddingBottom: 60,
} as const;

// Header row (back + title)
export const HEADER_STYLE = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  paddingTop: 52,
  paddingBottom: 8,
  paddingHorizontal: PAD,
} as const;
