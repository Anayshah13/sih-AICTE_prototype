import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Building2, Info } from 'lucide-react';

export default function ComplianceDashboard({
  compliance,
  roomRequirements,
  selectedRoomType,
  setSelectedRoomType
}) {
  const { overall_status, room_name, length, width, height, area, is_demo_placeholder } = compliance || {};

  // Status Banner styling
  const renderStatusBanner = () => {
    if (overall_status === 'PASS') {
      return (
        <div className="bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border border-emerald-500/50 rounded-xl p-4 flex items-center justify-between shadow-lg shadow-emerald-900/20 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-emerald-300 font-['Outfit'] tracking-wide">
                AICTE COMPLIANT
              </h3>
              <p className="text-xs text-emerald-400/80">Room meets all minimum infrastructure space requirements.</p>
            </div>
          </div>
          <span className="bg-emerald-500 text-slate-950 font-black text-xs px-3 py-1 rounded-md uppercase tracking-wider">
            PASS
          </span>
        </div>
      );
    }

    if (overall_status === 'FAIL') {
      return (
        <div className="bg-gradient-to-r from-rose-950/80 to-red-950/80 border border-rose-500/50 rounded-xl p-4 flex items-center justify-between shadow-lg shadow-rose-900/20 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-rose-300 font-['Outfit'] tracking-wide">
                NOT COMPLIANT
              </h3>
              <p className="text-xs text-rose-400/80">One or more room dimensions do not meet required minimums.</p>
            </div>
          </div>
          <span className="bg-rose-500 text-white font-black text-xs px-3 py-1 rounded-md uppercase tracking-wider">
            FAIL
          </span>
        </div>
      );
    }

    return (
      <div className="bg-gradient-to-r from-amber-950/80 to-yellow-950/80 border border-amber-500/50 rounded-xl p-4 flex items-center justify-between shadow-lg shadow-amber-900/20 mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-amber-300 font-['Outfit'] tracking-wide">
              CALIBRATING / UNRELIABLE
            </h3>
            <p className="text-xs text-amber-400/80">Position camera to capture floor & ceiling boundaries clearly.</p>
          </div>
        </div>
        <span className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1 rounded-md uppercase tracking-wider">
          UNRELIABLE
        </span>
      </div>
    );
  };

  const renderMetricRow = (label, metricData) => {
    if (!metricData) return null;
    const { measured, required, unit, status, difference_m } = metricData;

    const isPass = status === 'PASS';
    const isUnreliable = status === 'UNRELIABLE';

    return (
      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-all">
        <div>
          <span className="text-xs font-semibold text-slate-300">{label}</span>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Required: <span className="font-mono text-slate-200">{required} {unit}</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-sm font-bold font-mono text-white">
              {!isUnreliable ? `${measured} ${unit}` : '--'}
            </div>
            {!isUnreliable && (
              <div className={`text-[10px] font-semibold ${difference_m >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {difference_m >= 0 ? `+${difference_m} ${unit}` : `${difference_m} ${unit}`}
              </div>
            )}
          </div>

          <div>
            {isPass ? (
              <span className="bg-emerald-950 border border-emerald-700/60 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-md inline-block">
                PASS
              </span>
            ) : isUnreliable ? (
              <span className="bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold px-2 py-1 rounded-md inline-block">
                N/A
              </span>
            ) : (
              <span className="bg-rose-950 border border-rose-700/60 text-rose-400 text-xs font-bold px-2.5 py-1 rounded-md inline-block">
                FAIL
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col justify-between h-full shadow-2xl">
      
      <div>
        {/* Header & Room Type Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-base text-white font-['Outfit'] tracking-wide">
              AICTE Infrastructure Compliance
            </h2>
          </div>

          {/* Room Profile Dropdown */}
          <div className="flex items-center space-x-2">
            <label className="text-xs text-slate-400 font-medium">Room Type:</label>
            <select
              value={selectedRoomType}
              onChange={(e) => setSelectedRoomType(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {roomRequirements &&
                Object.entries(roomRequirements).map(([key, req]) => (
                  <option key={key} value={key}>
                    {req.name} ({req.min_area_sqm} m²)
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Big Compliance Status Banner */}
        {renderStatusBanner()}

        {/* Dimension Breakdown Cards */}
        <div className="space-y-2.5">
          {renderMetricRow('Room Length', length)}
          {renderMetricRow('Room Width', width)}
          {renderMetricRow('Ceiling Height', height)}
          {renderMetricRow('Total Floor Area', area)}
        </div>
      </div>

      {/* Demo Disclaimer Note */}
      <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-start space-x-2 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/50">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <span>
          <strong>Note:</strong> Standard room requirement values shown are configurable demo presets. Click 'Requirements' in header to customize standards for your institution.
        </span>
      </div>

    </div>
  );
}
