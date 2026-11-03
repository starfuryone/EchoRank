// Accessibility rule ids, shared by the rules and the copy (see
// data/structured_data.ts for why this lives outside rules/).

/** "color-contrast" → "accessibility.color_contrast". Ids are lower snake case. */
export function a11yRuleId(axeId: string): string {
  return `accessibility.${axeId.replace(/-/g, "_")}`;
}
