import type { DeformSettings } from "./features06";
export const jellyPresets = {
  soft: {
    label: "Muito mole",
    stiffness: 42,
    damping: 1.4,
    volume: 0.82,
    maxStretch: 1.85,
    intensity: 1.8,
    movementInfluence: 1.45,
    radiusConstraint: 0.2,
  },
  balanced: {
    label: "Macia",
    stiffness: 65,
    damping: 2.4,
    volume: 0.88,
    maxStretch: 1.7,
    intensity: 1.35,
    movementInfluence: 1.25,
    radiusConstraint: 0.3,
  },
  firm: {
    label: "Firme",
    stiffness: 145,
    damping: 6,
    volume: 0.97,
    maxStretch: 1.3,
    intensity: 0.55,
    movementInfluence: 0.65,
    radiusConstraint: 0.7,
  },
} as const;
export function jellyPreset(
  name: keyof typeof jellyPresets,
): Partial<DeformSettings> {
  const { label: _label, ...settings } = jellyPresets[name];
  return settings;
}
