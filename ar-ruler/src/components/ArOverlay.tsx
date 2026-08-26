import { useState } from "react";
import type { ArUiState, LineSummary } from "../ar/types";

type ArOverlayProps = {
  ui: ArUiState;
  onUndo: () => void;
  onClear: () => void;
  onPlace: () => void;
  onScreenshot: () => Promise<void>;
  onToggleArea: (visible: boolean) => void;
  onExit: () => void;
};

export function ArOverlay({
  ui,
  onUndo,
  onClear,
  onPlace,
  onScreenshot,
  onToggleArea,
  onExit,
}: ArOverlayProps) {
  const canUndo = ui.pending || ui.lines.length > 0;
  const areaReady = Boolean(ui.areaLabel);
  const [shotBusy, setShotBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleShot() {
    if (shotBusy) {
      return;
    }
    setShotBusy(true);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    try {
      await onScreenshot();
      setToast("Screenshot saved");
    } catch {
      setToast("Screenshot failed");
    } finally {
      setShotBusy(false);
      window.setTimeout(() => setToast(null), 1800);
    }
  }

  return (
    <div className="overlay">
      {flash && <div className="shot-flash" aria-hidden="true" />}

      <header className="hud-top">
        <button type="button" className="round-btn" aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
          <UndoIcon />
        </button>
        <p className="hud-status">{ui.instruction}</p>
        <div className="hud-top-right">
          <button
            type="button"
            className={`round-btn area-round${ui.areaVisible ? " on" : ""}`}
            disabled={!areaReady}
            aria-label="Area"
            aria-pressed={ui.areaVisible}
            onClick={() => onToggleArea(!ui.areaVisible)}
          >
            <span className={`area-dot${areaReady ? " ready" : ""}`} />
          </button>
          <button
            type="button"
            className="round-btn"
            aria-label="Clear measurements"
            disabled={!canUndo}
            onClick={onClear}
          >
            <TrashIcon />
          </button>
          <button type="button" className="round-btn" aria-label="Close" onClick={onExit}>
            <CloseIcon />
          </button>
        </div>
      </header>

      {ui.areaVisible && ui.areaLabel && (
        <aside className="area-panel">
          <strong>{ui.areaLabel}</strong>
          <span>
            {ui.cornerCount} corners
            {ui.heightLabel ? ` · ${ui.heightLabel}` : ""}
          </span>
        </aside>
      )}

      <div className="reticle-layer" aria-hidden="true">
        <div className={`hud-reticle${ui.hitValid ? " locked" : ""}`}>
          <span className="reticle-dot" />
        </div>
      </div>

      <footer className="hud-bottom">
        {ui.lines.length > 0 && (
          <ul className="line-list">
            {ui.lines.map((line, index) => (
              <LineChip key={line.id} line={line} index={index + 1} />
            ))}
          </ul>
        )}

        <div className="dock">
          <button
            type="button"
            className="plus-btn"
            aria-label="Add point at center"
            disabled={!ui.canPlace}
            onClick={onPlace}
          >
            +
          </button>
          <button
            type="button"
            className="shot-btn"
            aria-label="Screenshot"
            disabled={shotBusy}
            onClick={() => {
              void handleShot();
            }}
          >
            <ShutterIcon />
            <span>Shot</span>
          </button>
        </div>
      </footer>

      {toast && <p className="hud-toast">{toast}</p>}
    </div>
  );
}

function LineChip({ line, index }: { line: LineSummary; index: number }) {
  return (
    <li className="line-chip">
      <span className="line-index">L{index}</span>
      <span className="line-len">{line.label}</span>
    </li>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.5 8c-2.4 0-4.5.9-6.1 2.4L4 8v8h8l-2.6-2.6A6.5 6.5 0 1 1 12.5 21a1 1 0 1 0 0 2 8.5 8.5 0 1 0 0-15Z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM8 9h2v9H8V9Zm-2 12h12a1 1 0 0 0 1-1V8H5v12a1 1 0 0 0 1 1Z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z"
      />
    </svg>
  );
}

function ShutterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 4h6l1.2 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.8L9 4Zm3 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z"
      />
    </svg>
  );
}
