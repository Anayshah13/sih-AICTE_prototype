import React from 'react';
import { Box, Activity, Zap } from 'lucide-react';

export default function Header({ wsStatus, depthModelReady }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Box className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg text-white font-['Outfit'] tracking-wide">
                Digital Dimension Tracking
              </h1>
              <span className="bg-cyan-950 text-cyan-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-cyan-800/50">
                3D Real-time Measurement
              </span>
            </div>
            <p className="text-xs text-slate-400">Computer Vision & Metric Depth Calibration Engine</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center space-x-3">
          
          {/* Depth Model Readiness */}
          <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
            <Zap className={`w-3.5 h-3.5 ${depthModelReady ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="text-slate-300">
              Depth AI: <strong className={depthModelReady ? 'text-emerald-400' : 'text-amber-400'}>
                {depthModelReady ? 'Ready' : 'Initializing...'}
              </strong>
            </span>
          </div>

          {/* WebSocket Status */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
            <Activity className={`w-3.5 h-3.5 ${wsStatus === 'connected' ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="text-slate-300">
              WS: <strong className={
                wsStatus === 'connected' ? 'text-emerald-400' : 
                wsStatus === 'error' ? 'text-rose-400' : 'text-slate-400'
              }>
                {wsStatus.toUpperCase()}
              </strong>
            </span>
          </div>

        </div>

      </div>
    </header>
  );
}
