import type { ArUiState } from "../ar/types";

type ArOverlayProps = {
  ui: ArUiState;
  onMeasureAgain: () => void;
  onExit: () => void;
};

export function ArOverlay({ ui, onMeasureAgain, onExit }: ArOverlayProps) {
  return (
    <div className="overlay">
      <header className="overlay-top">
        <p>{ui.headline}</p>
        <button type="button" className="ghost" onClick={onExit}>
          Close
        </button>
      </header>

      <div className="tap-surface">
        <div
          className={`hud-reticle ${ui.hitValid ? "locked" : ""} ${ui.phase === "measured" ? "hidden" : ""}`}
          aria-hidden="true"
        />
      </div>

      <footer className="overlay-bottom">
        {ui.phase === "measured" && ui.distanceLabel ? (
          <>
            <p className="distance">{ui.distanceLabel}</p>
            <button type="button" className="again" onClick={onMeasureAgain}>
              Measure Again
            </button>
          </>
        ) : (
          <p className="coach">{ui.instruction}</p>
        )}
      </footer>
    </div>
  );
}
