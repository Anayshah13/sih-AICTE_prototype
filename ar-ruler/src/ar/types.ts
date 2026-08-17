export type MeasurePhase = "scanning" | "measuring";

export type LineSummary = {
  id: number;
  label: string;
  meters: number;
};

export type ArUiState = {
  phase: MeasurePhase;
  headline: string;
  instruction: string;
  pending: boolean;
  previewLabel: string | null;
  lines: LineSummary[];
  areaLabel: string | null;
  heightLabel: string | null;
  cornerCount: number;
  roomLocked: boolean;
  areaVisible: boolean;
  hitValid: boolean;
  tracking: boolean;
  error: string | null;
};

export const INITIAL_UI: ArUiState = {
  phase: "scanning",
  headline: "Move your phone to scan",
  instruction: "Sweep the room, then tap two points for a tape line.",
  pending: false,
  previewLabel: null,
  lines: [],
  areaLabel: null,
  heightLabel: null,
  cornerCount: 0,
  roomLocked: false,
  areaVisible: false,
  hitValid: false,
  tracking: true,
  error: null,
};

export type WebXRProbe = {
  secureContext: boolean;
  xrInNavigator: boolean;
  immersiveArSupported: boolean;
  isAndroid: boolean;
  isChrome: boolean;
  userAgent: string;
  ready: boolean;
  blockingReason: string | null;
};
