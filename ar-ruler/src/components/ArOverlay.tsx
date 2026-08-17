import type { ArUiState, LineSummary } from "../ar/types";

type ArOverlayProps = {
  ui: ArUiState;
  onUndo: () => void;
  onDeleteLine: (id: number) => void;
  onToggleArea: (visible: boolean) => void;
  onExit: () => void;
};

export function ArOverlay({
  ui,
  onUndo,
  onDeleteLine,
  onToggleArea,
  onExit,
}: ArOverlayProps) {
  const canUndo = ui.pending || ui.lines.length > 0;
  const areaReady = Boolean(ui.areaLabel);

  return (
    <div className="overlay">
      <header className="overlay-chrome">
        <div className="overlay-top">
          <button type="button" className="ghost" onClick={onExit}>
            Close
          </button>
          <p>{ui.headline}</p>
          <button
            type="button"
            className={`area-btn${ui.areaVisible ? " on" : ""}`}
            disabled={!areaReady}
            aria-pressed={ui.areaVisible}
            onClick={() => onToggleArea(!ui.areaVisible)}
          >
            <span className={`area-dot${areaReady ? " ready" : ""}`} aria-hidden="true" />
            Area
          </button>
        </div>
        {ui.areaVisible && ui.areaLabel && (
          <aside className="area-panel">
            <strong>{ui.areaLabel}</strong>
            <span>
              {ui.cornerCount} corners
              {ui.heightLabel ? ` · ${ui.heightLabel}` : ""}
            </span>
          </aside>
        )}
      </header>

      <div className="tap-surface">
        <div
          className={`hud-reticle ${ui.hitValid ? "locked" : ""}`}
          aria-hidden="true"
        />
      </div>

      <footer className="overlay-bottom">
        {ui.previewLabel && <p className="distance">{ui.previewLabel}</p>}

        {ui.lines.length > 0 && (
          <ul className="line-list">
            {ui.lines.map((line, index) => (
              <LineChip
                key={line.id}
                line={line}
                index={index + 1}
                onDelete={() => onDeleteLine(line.id)}
              />
            ))}
          </ul>
        )}

        <p className="coach">{ui.instruction}</p>

        <div className="toolbar">
          <button type="button" className="ghost" disabled={!canUndo} onClick={onUndo}>
            {ui.pending ? "Undo point" : "Delete line"}
          </button>
        </div>
      </footer>
    </div>
  );
}

function LineChip({
  line,
  index,
  onDelete,
}: {
  line: LineSummary;
  index: number;
  onDelete: () => void;
}) {
  return (
    <li className="line-chip">
      <span className="line-index">L{index}</span>
      <span className="line-len">{line.label}</span>
      <button type="button" className="chip-x" aria-label={`Delete line ${index}`} onClick={onDelete}>
        ×
      </button>
    </li>
  );
}
