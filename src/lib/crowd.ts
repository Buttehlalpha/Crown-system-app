export type CrowdTone = "normal" | "warning" | "near" | "critical";

export interface CrowdStatus {
  tone: CrowdTone;
  label: string;
  percent: number;
  available: number;
  warningLevel: number;
}

export function crowdStatus(
  occupancy: number,
  capacity: number,
  warningThreshold = 80,
): CrowdStatus {
  const cap = Math.max(capacity, 1);
  const warningLevel = Math.floor((cap * warningThreshold) / 100);
  const percent = Math.min(100, Math.round((occupancy / cap) * 100));
  const available = Math.max(0, cap - occupancy);

  let tone: CrowdTone = "normal";
  let label = "Normal";
  if (occupancy >= cap) {
    tone = "critical";
    label = "Critical / Full";
  } else if (available <= Math.max(1, Math.round(cap * 0.01))) {
    tone = "near";
    label = "Near Capacity";
  } else if (occupancy >= warningLevel) {
    tone = "warning";
    label = "Warning";
  }

  return { tone, label, percent, available, warningLevel };
}

export const toneClasses: Record<CrowdTone, string> = {
  normal: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  near: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  critical: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

export const toneBar: Record<CrowdTone, string> = {
  normal: "bg-emerald-500",
  warning: "bg-amber-500",
  near: "bg-orange-500",
  critical: "bg-red-500",
};
