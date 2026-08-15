import React from 'react';
import { Ruler, ShieldCheck, Info, MousePointerClick, CheckCircle2, RefreshCw } from 'lucide-react';

export default function RulerDashboard({ rulerData, selectedPoints = [], setSelectedPoints }) {
  const { measured_cm, confidence } = rulerData || {};

  const confidencePercent = Math.round((confidence || 0) * 100);

  const handleResetPoints = () => {
    if (setSelectedPoints) {
      setSelectedPoints([]);
    }
  };

  const renderStatusBanner = () => {
    if (selectedPoints && selectedPoints.length === 2 && measured_cm !== null && measured_cm !== undefined) {
      return (
        <div className="bg-gradient-to-r from-emerald-950/90 to-teal-950/90 border border-emerald-500/50 rounded-2xl p-4 flex items-center justify-between shadow-xl shadow-emerald-900/20 mb-4 glow-emerald">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-widest">
                Metric Depth Pipeline
              </div>
              <h3 className="font-extrabold text-lg text-emerald-200 font-['Outfit'] tracking-wide">
                MEASUREMENT COMPLETE
              </h3>
            </div>
          </div>
          <button
            onClick={handleResetPoints}
            className="bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs px-3 py-1.5 rounded-lg border border-cyan-800/50 flex items-center gap-1 cursor-pointer transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      );
    }

    return (
      <div className="bg-gradient-to-r from-slate-900 to-cyan-950/50 border border-cyan-800/50 rounded-2xl p-4 flex items-center justify-between shadow-xl mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 animate-pulse">
            <MousePointerClick className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-widest">
              Interactive 3D Pipeline
            </div>
            <h3 className="font-extrabold text-base text-slate-200 font-['Outfit'] tracking-wide">
              {selectedPoints.length === 0
                ? 'SELECT 2 POINTS ON OBJECT'
                : selectedPoints.length === 1
                ? 'SELECT POINT 2 ON OBJECT'
                : 'COMPUTING 3D DISTANCE'}
            </h3>
          </div>
        </div>
        {selectedPoints.length > 0 && (
          <button
            onClick={handleResetPoints}
            className="bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs px-3 py-1.5 rounded-lg border border-cyan-800/50 flex items-center gap-1 cursor-pointer transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col justify-between h-full shadow-2xl">
      
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Ruler className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-base text-white font-['Outfit'] tracking-wide">
              Dimension Measurement
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-800/60">
            3D Metric Depth
          </span>
        </div>

        {/* Status Banner */}
        {renderStatusBanner()}

        {/* Measurement Specs Card */}
        <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-4">
          
          <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Object</span>
            <span className="text-sm font-bold text-white font-mono">
              Selected Endpoints
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-800/60">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Measured Length</span>
            <span className="text-2xl font-extrabold text-emerald-400 font-mono">
              {measured_cm !== null && measured_cm !== undefined ? `${measured_cm.toFixed(1)} cm` : '--'}
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pipeline Confidence</span>
            <span className="text-sm font-bold text-cyan-300 font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              {confidence !== null && confidence !== undefined ? `${confidencePercent}%` : '--'}
            </span>
          </div>

        </div>
      </div>

      {/* Detection Guidance Note */}
      <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-start space-x-2 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/50">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <span>
          <strong>How to measure:</strong> Click two endpoints directly on any object in the live camera preview. The metric depth engine back-projects the selected 2D points into 3D space to calculate real-world Euclidean distance.
        </span>
      </div>

    </div>
  );
}
