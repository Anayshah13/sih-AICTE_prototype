import React from 'react';
import { Ruler, Maximize2, ShieldAlert, CheckCircle2, HelpCircle } from 'lucide-react';

export default function MeasurementOverlay({ dimensions, processingTimeMs }) {
  const { length_m, width_m, height_m, area_sqm, confidence, reliable, notes } = dimensions || {};

  const confidencePercent = Math.round((confidence || 0) * 100);

  // Confidence color pill
  const getConfidenceBadge = () => {
    if (!reliable || confidencePercent < 50) {
      return (
        <span className="bg-rose-950/80 text-rose-300 border border-rose-800/60 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          Unreliable ({confidencePercent}%)
        </span>
      );
    }
    if (confidencePercent >= 75) {
      return (
        <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          High ({confidencePercent}%)
        </span>
      );
    }
    return (
      <span className="bg-amber-950/80 text-amber-300 border border-amber-800/60 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
        <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
        Moderate ({confidencePercent}%)
      </span>
    );
  };

  return (
    <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col justify-between h-full shadow-xl">
      
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Ruler className="w-5 h-5 text-cyan-400" />
          <h2 className="font-bold text-sm text-white font-['Outfit'] tracking-wide">
            Live Room Measurements
          </h2>
        </div>
        {getConfidenceBadge()}
      </div>

      {/* Grid of Estimated Dimensions */}
      <div className="grid grid-cols-2 gap-3 my-3">
        
        {/* Length */}
        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Length</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-cyan-300 font-mono">
              {reliable && length_m !== null ? length_m.toFixed(2) : '--'}
            </span>
            <span className="text-xs font-semibold text-slate-400">m</span>
          </div>
        </div>

        {/* Width */}
        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Width</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-cyan-300 font-mono">
              {reliable && width_m !== null ? width_m.toFixed(2) : '--'}
            </span>
            <span className="text-xs font-semibold text-slate-400">m</span>
          </div>
        </div>

        {/* Height */}
        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Ceiling Height</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-cyan-300 font-mono">
              {reliable && height_m !== null ? height_m.toFixed(2) : '--'}
            </span>
            <span className="text-xs font-semibold text-slate-400">m</span>
          </div>
        </div>

        {/* Floor Area */}
        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Floor Area</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-emerald-400 font-mono">
              {reliable && area_sqm !== null ? area_sqm.toFixed(2) : '--'}
            </span>
            <span className="text-xs font-semibold text-slate-400">m²</span>
          </div>
        </div>

      </div>

      {/* Footer Info & Detection Notes */}
      <div className="pt-2 border-t border-slate-800/60 text-xs">
        {notes && notes.length > 0 ? (
          <div className="text-[11px] text-amber-300/90 bg-amber-950/30 p-2 rounded-lg border border-amber-900/40 mb-2">
            ⚠️ {notes[0]}
          </div>
        ) : null}

        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span>Processing time: <strong className="text-slate-200">{processingTimeMs || 0} ms</strong></span>
          <span>Engine: Open3D RANSAC</span>
        </div>
      </div>

    </div>
  );
}
