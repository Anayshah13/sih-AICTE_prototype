export type MeasurePhase = "scanning" | "place-a" | "place-b" | "measured";

export type ArUiState = {
  phase: MeasurePhase;
  headline: string;
  instruction: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  hitValid: boolean;
  tracking: boolean;
  error: string | null;
};

export const INITIAL_UI: ArUiState = {
  phase: "scanning",
  headline: "Move your phone to scan",
  instruction: "Move your phone slowly to scan the room.",
  distanceLabel: null,
  distanceMeters: null,
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
