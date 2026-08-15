import type { WebXRProbe } from "./types";

function isAndroid(ua: string): boolean {
  return /Android/i.test(ua);
}

function isChrome(ua: string): boolean {
  return /Chrome|CriOS/i.test(ua) && !/Edg|OPR|SamsungBrowser/i.test(ua);
}

export async function probeWebXR(): Promise<WebXRProbe> {
  const userAgent = navigator.userAgent;
  const probe: WebXRProbe = {
    secureContext: window.isSecureContext,
    xrInNavigator: typeof navigator !== "undefined" && "xr" in navigator && Boolean(navigator.xr),
    immersiveArSupported: false,
    isAndroid: isAndroid(userAgent),
    isChrome: isChrome(userAgent),
    userAgent,
    ready: false,
    blockingReason: null,
  };

  if (!probe.secureContext) {
    probe.blockingReason =
      "WebXR needs a secure context. Open this page over HTTPS or via localhost (Chrome port forwarding).";
    logProbe(probe);
    return probe;
  }

  if (!navigator.xr) {
    probe.blockingReason =
      "This browser does not expose the WebXR Device API. Open the page in Chrome on an ARCore Android phone.";
    logProbe(probe);
    return probe;
  }

  try {
    probe.immersiveArSupported = await navigator.xr.isSessionSupported("immersive-ar");
  } catch (error) {
    probe.blockingReason = "Chrome blocked the WebXR availability check. Allow XR/camera permissions and retry.";
    logProbe(probe, error);
    return probe;
  }

  if (!probe.immersiveArSupported) {
    probe.blockingReason = describeUnsupported(probe);
    logProbe(probe);
    return probe;
  }

  probe.ready = true;
  logProbe(probe);
  return probe;
}

function describeUnsupported(probe: WebXRProbe): string {
  if (!probe.isAndroid) {
    return "immersive-ar is not available here. WebXR AR only runs in Chrome on an ARCore Android phone — not desktop, and not iOS.";
  }
  if (!probe.isChrome) {
    return "immersive-ar is not available in this browser. Use Google Chrome, not Samsung Internet or Firefox.";
  }
  return "Chrome reports immersive-ar as unavailable. Install Google Play Services for AR, then retry on this Nothing Phone (2a) or another ARCore device.";
}

function logProbe(probe: WebXRProbe, extra?: unknown): void {
  console.info("[AR Ruler] WebXR probe", {
    secureContext: probe.secureContext,
    navigatorXr: probe.xrInNavigator,
    immersiveAr: probe.immersiveArSupported,
    android: probe.isAndroid,
    chrome: probe.isChrome,
    ready: probe.ready,
    reason: probe.blockingReason,
  });
  if (extra) {
    console.warn("[AR Ruler] probe extra", extra);
  }
}

export function mapXrError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Could not start a WebXR AR session.";
  }

  const { name, message } = error;

  if (name === "NotAllowedError" || /denied|permission/i.test(message)) {
    return "Camera or AR permission was denied. Allow camera access in Chrome, then tap Start Measuring again.";
  }
  if (name === "NotFoundError" || /camera/i.test(message) && /not available|not found/i.test(message)) {
    return "The camera is unavailable. Close other camera apps and try again.";
  }
  if (name === "SecurityError") {
    return "WebXR requires HTTPS or localhost. Use the secure Vite URL or Chrome USB port forwarding.";
  }
  if (name === "NotSupportedError" || /not supported/i.test(message) || /hit.?test/i.test(message)) {
    return "WebXR hit-testing is not supported on this browser/device. This app will not fake AR with the camera.";
  }
  if (name === "AbortError") {
    return "The AR session was cancelled.";
  }
  if (name === "InvalidStateError") {
    return "An AR session is already active.";
  }

  return message || "Could not start a WebXR AR session.";
}
