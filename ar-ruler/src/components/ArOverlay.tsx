import type { ArUiState, LineSummary } from "../ar/types";

type ArOverlayProps = {
  ui: ArUiState;
  onUndo: () => void;
  onDeleteLine: (id: number) => void;
  onExit: () => void;
};

export function ArOverlay({ ui, onUndo, onDeleteLine, onExit }: ArOverlayProps) {
  const canUndo = ui.pending || ui.lines.length > 0;

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
          className={`hud-reticle ${ui.hitValid ? "locked" : ""}`}
          aria-hidden="true"
        />
      </div>

      <footer className="overlay-bottom">
        {(ui.areaLabel || ui.roomLocked) && (
          <div className="stats">
            {ui.roomLocked ? (
              <strong>
                {ui.cornerCount} corners · {ui.areaLabel}
                {ui.heightLabel ? ` · ${ui.heightLabel}` : ""}
              </strong>
            ) : (
              <strong>{ui.areaLabel ?? "Mapping room…"}</strong>
            )}
          </div>
        )}

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
      <span>
        L{index} · {line.label}
      </span>
      <button type="button" className="chip-x" aria-label={`Delete line ${index}`} onClick={onDelete}>
        ×
      </button>
    </li>
  );
}
