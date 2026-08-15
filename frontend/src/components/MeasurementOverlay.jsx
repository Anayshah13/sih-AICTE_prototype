import React from 'react';
import { Ruler } from 'lucide-react';

export default function MeasurementOverlay({ dimensions, processingTimeMs }) {
  const { length_m, width_m, height_m, area_sqm, notes } = dimensions || {};

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
      </div>

      {/* Grid of Estimated Dimensions */}
      <div className="grid grid-cols-2 gap-3 my-3">
        
        {/* Length */}
        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Room Length</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-cyan-300 font-mono">
              {length_m !== null && length_m !== undefined ? length_m.toFixed(2) : '--'}
            </span>
            <span className="text-xs font-semibold text-slate-400">m</span>
          </div>
        </div>

        {/* Width */}
        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Room Width</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-cyan-300 font-mono">
              {width_m !== null && width_m !== undefined ? width_m.toFixed(2) : '--'}
            </span>
            <span className="text-xs font-semibold text-slate-400">m</span>
          </div>
        </div>

        {/* Height */}
        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Ceiling Height</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-cyan-300 font-mono">
              {height_m !== null && height_m !== undefined ? height_m.toFixed(2) : '--'}
            </span>
            <span className="text-xs font-semibold text-slate-400">m</span>
          </div>
        </div>

        {/* Floor Area */}
        <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Floor Area</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-emerald-400 font-mono">
              {area_sqm !== null && area_sqm !== undefined ? area_sqm.toFixed(2) : '--'}
            </span>
            <span className="text-xs font-semibold text-slate-400">m²</span>
          </div>
        </div>

      </div>

      {/* Footer Info & Detection Notes */}
      <div className="pt-2 border-t border-slate-800/60 text-xs">
        {notes && notes.length > 0 ? (
          <div className="text-[11px] text-cyan-300/90 bg-cyan-950/30 p-2 rounded-lg border border-cyan-900/40 mb-2">
            ℹ️ {notes[0]}
          </div>
        ) : (
          <div className="text-[11px] text-cyan-300/90 bg-cyan-950/30 p-2 rounded-lg border border-cyan-900/40 mb-2">
            📷 Move the camera slowly around the room to scan the floor, walls and ceiling.
          </div>
        )}

        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span>Processing time: <strong className="text-slate-200">{processingTimeMs || 0} ms</strong></span>
          <span>Engine: Open3D RANSAC</span>
        </div>
      </div>

    </div>
  );
}
