import { useEffect, useRef, useState } from "react";
import type { ArRulerHandle } from "./ar/session";
import { startArSession } from "./ar/session";
import { INITIAL_UI, type ArUiState, type WebXRProbe } from "./ar/types";
import { probeWebXR } from "./ar/webxr";
import { ArOverlay } from "./components/ArOverlay";
import { Landing } from "./components/Landing";

export default function App() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<ArRulerHandle | null>(null);
  const [probe, setProbe] = useState<WebXRProbe | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [arActive, setArActive] = useState(false);
  const [ui, setUi] = useState<ArUiState>(INITIAL_UI);

  useEffect(() => {
    let cancelled = false;
    probeWebXR().then((result) => {
      if (!cancelled) {
        setProbe(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStart() {
    const overlayRoot = overlayRef.current;
    if (!overlayRoot || busy || sessionRef.current) {
      return;
    }
    if (!probe?.ready) {
      setSessionError(
        probe?.blockingReason ??
          "WebXR immersive-ar is not available. This app will not fake AR with the camera.",
      );
      return;
    }

    overlayRoot.dataset.active = "true";
    setBusy(true);
    setSessionError(null);
    setArActive(true);

    try {
      const handle = await startArSession({
        overlayRoot,
        onUi: setUi,
        onEnded: () => {
          sessionRef.current = null;
          setArActive(false);
          setUi(INITIAL_UI);
        },
      });
      sessionRef.current = handle;
    } catch (error) {
      overlayRoot.dataset.active = "false";
      setArActive(false);
      setSessionError(error instanceof Error ? error.message : "Could not start AR.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!arActive && (
        <Landing
          probe={probe}
          busy={busy}
          sessionError={sessionError}
          onStart={() => {
            void handleStart();
          }}
        />
      )}
      <div
        id="ar-overlay"
        ref={overlayRef}
        hidden={!arActive}
        data-active={arActive ? "true" : "false"}
      >
        <ArOverlay
          ui={ui}
          onUndo={() => sessionRef.current?.undo()}
          onClear={() => sessionRef.current?.clearAll()}
          onPlace={() => {
            sessionRef.current?.placePoint();
          }}
          onScreenshot={async () => {
            await sessionRef.current?.captureScreenshot();
          }}
          onToggleArea={(visible) => sessionRef.current?.setAreaVisible(visible)}
          onExit={() => {
            void sessionRef.current?.end();
          }}
        />
      </div>
    </>
  );
}
