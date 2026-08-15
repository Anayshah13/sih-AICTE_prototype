import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, CameraOff, AlertCircle, Ruler, Target, RefreshCw } from 'lucide-react';

export default function CameraFeed({
  onFrameCaptured,
  depthHeatmapB64,
  isTracking,
  setIsTracking,
  wsStatus,
  selectedPoints = [],
  setSelectedPoints
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const streamRef = useRef(null);

  // Attach MediaStream to <video> when isCameraActive becomes true
  useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;

      video
        .play()
        .then(() => {
          console.log('[Camera Debug] video.play() successful!');
          console.log('[Camera Debug] videoRef.current.srcObject:', video.srcObject);
          console.log('[Camera Debug] videoRef.current.videoWidth:', video.videoWidth);
          console.log('[Camera Debug] videoRef.current.videoHeight:', video.videoHeight);
          console.log('[Camera Debug] videoRef.current.readyState:', video.readyState);
        })
        .catch((err) => {
          console.error('[Camera Debug] video.play() error:', err);
        });
    }
  }, [isCameraActive]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      console.log('[Camera Debug - LoadedMetadata] videoWidth:', video.videoWidth);
      console.log('[Camera Debug - LoadedMetadata] videoHeight:', video.videoHeight);
      console.log('[Camera Debug - LoadedMetadata] readyState:', video.readyState);
    }
  };

  const startCamera = async () => {
    setCameraError(null);

    // 1. Safe detection of navigator and mediaDevices
    if (typeof navigator === 'undefined') {
      setCameraError('Camera access is unavailable in this environment.');
      setIsCameraActive(false);
      if (setIsTracking) setIsTracking(false);
      return;
    }

    const hasMediaDevices = navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
    const legacyGetUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;

    if (!hasMediaDevices && !legacyGetUserMedia) {
      const isSecure = typeof window !== 'undefined' && window.isSecureContext;
      const errorMsg = !isSecure
        ? 'Camera access is unavailable in this browser/context. Browsers require a Secure Context (HTTPS or localhost) to access the camera over mobile/LAN.'
        : 'Camera access is unavailable in this browser/context.';

      setCameraError(errorMsg);
      setIsCameraActive(false);
      if (setIsTracking) setIsTracking(false);
      return;
    }

    try {
      console.log('[Camera Debug] Requesting getUserMedia stream...');
      let stream = null;

      if (hasMediaDevices) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
          });
        } catch (constraintErr) {
          console.warn('[Camera Debug] facingMode constraint failed, falling back to basic video: true', constraintErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      } else if (legacyGetUserMedia) {
        stream = await new Promise((resolve, reject) => {
          legacyGetUserMedia.call(navigator, { video: true, audio: false }, resolve, reject);
        });
      }

      if (!stream) {
        throw new Error('Failed to obtain video stream from device camera.');
      }

      streamRef.current = stream;
      setIsCameraActive(true);
      if (setIsTracking) setIsTracking(true);

      console.log('[Camera Debug] Stream obtained successfully.');
    } catch (err) {
      console.error('[Camera Debug] getUserMedia error:', err);
      let errMsg = err.message || 'Could not access web camera. Please check permissions.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errMsg = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errMsg = 'No video camera device was found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errMsg = 'Camera is currently in use by another application or tab.';
      }
      setCameraError(errMsg);
      setIsCameraActive(false);
      if (setIsTracking) setIsTracking(false);
    }
  };

  const stopCamera = useCallback(() => {
    console.log('[Camera Debug] Stopping camera...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    if (setIsTracking) setIsTracking(false);
  }, [setIsTracking]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Frame capture loop for sending camera frames & selected points to backend
  useEffect(() => {
    if (!isCameraActive || !isTracking || !onFrameCaptured) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const frameB64 = canvas.toDataURL('image/jpeg', 0.65);

        let pixelPoints = null;
        if (selectedPoints && selectedPoints.length === 2) {
          pixelPoints = selectedPoints.map((p) => [
            Math.round(p.x * video.videoWidth),
            Math.round(p.y * video.videoHeight)
          ]);
        }

        onFrameCaptured(frameB64, pixelPoints);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [isCameraActive, isTracking, onFrameCaptured, selectedPoints]);

  const handleMeasureRulerClick = () => {
    if (setSelectedPoints) {
      setSelectedPoints([]);
    }
  };

  const handleViewportClick = (e) => {
    if (!isCameraActive || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, clickX / rect.width));
    const normY = Math.max(0, Math.min(1, clickY / rect.height));

    if (setSelectedPoints) {
      setSelectedPoints((prev) => {
        if (!prev || prev.length >= 2) {
          return [{ x: normX, y: normY }];
        }
        return [...prev, { x: normX, y: normY }];
      });
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col h-full shadow-2xl relative overflow-hidden">
      
      {/* Offscreen hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          {!isCameraActive ? (
            <button
              onClick={startCamera}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs flex items-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Start Camera</span>
            </button>
          ) : (
            <>
              <button
                onClick={stopCamera}
                className="px-3.5 py-1.5 rounded-xl bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700/50 text-rose-300 font-medium text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <CameraOff className="w-4 h-4" />
                <span>Stop Camera</span>
              </button>

              {selectedPoints && selectedPoints.length > 0 && (
                <button
                  onClick={handleMeasureRulerClick}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-medium text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Points</span>
                </button>
              )}
            </>
          )}
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Camera Status: </span>
          <strong className={isCameraActive ? 'text-emerald-400' : 'text-slate-500'}>
            {isCameraActive ? 'LIVE PREVIEW' : 'INACTIVE'}
          </strong>
        </div>
      </div>

      {/* Raw Camera Viewport Container */}
      <div className="relative flex-1 min-h-[320px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center">
        
        {/* RAW CAMERA VIDEO ELEMENT - Always rendered in DOM */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleLoadedMetadata}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: isCameraActive ? 'block' : 'none'
          }}
        />

        {/* Interactive Point Selection Overlay */}
        {isCameraActive && (
          <div
            ref={viewportRef}
            onClick={handleViewportClick}
            className="absolute inset-0 cursor-crosshair z-10"
          >
            {/* Connecting SVG Line */}
            {selectedPoints && selectedPoints.length > 0 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {selectedPoints.length === 2 && (
                  <line
                    x1={`${selectedPoints[0].x * 100}%`}
                    y1={`${selectedPoints[0].y * 100}%`}
                    x2={`${selectedPoints[1].x * 100}%`}
                    y2={`${selectedPoints[1].y * 100}%`}
                    stroke="#00E5FF"
                    strokeWidth="3"
                    strokeDasharray="6 3"
                    className="animate-pulse"
                  />
                )}
              </svg>
            )}

            {/* Selected Endpoint Markers */}
            {selectedPoints &&
              selectedPoints.map((pt, idx) => (
                <div
                  key={idx}
                  style={{
                    left: `${pt.x * 100}%`,
                    top: `${pt.y * 100}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  className="absolute pointer-events-none flex flex-col items-center z-20"
                >
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-7 w-7 rounded-full bg-cyan-400 opacity-75"></span>
                    <div className="w-6 h-6 rounded-full bg-cyan-400 border-2 border-slate-950 flex items-center justify-center text-slate-950 font-black text-[11px] shadow-lg shadow-cyan-500/50">
                      {idx + 1}
                    </div>
                  </div>
                  <span className="mt-1 bg-slate-950/90 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-500/40 shadow">
                    Point {idx + 1}
                  </span>
                </div>
              ))}

            {/* Floating Banner Instructions */}
            <div className="absolute top-3 left-3 right-3 pointer-events-none flex justify-center z-20">
              <div className="bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 text-cyan-300 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
                <span>
                  {!selectedPoints || selectedPoints.length === 0
                    ? 'Select two points on the object'
                    : selectedPoints.length === 1
                    ? 'Point 1 set! Now click Point 2'
                    : '2 points set! Calculating 3D metric distance...'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Camera Off State / Prompt */}
        {!isCameraActive && !cameraError && (
          <div className="text-center p-8 max-w-sm absolute">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-cyan-400 shadow-xl">
              <Camera className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Live Camera Feed</h3>
            <p className="text-xs text-slate-400 mb-6">
              Click 'Start Camera' to initialize raw live video preview.
            </p>
            <button
              onClick={startCamera}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-all shadow-lg shadow-cyan-500/25 cursor-pointer"
            >
              Start Camera
            </button>
          </div>
        )}

        {/* Camera Permission Error */}
        {cameraError && (
          <div className="text-center p-6 max-w-md bg-rose-950/30 border border-rose-800/50 rounded-xl absolute">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-rose-200 mb-1">Camera Access Error</h4>
            <p className="text-xs text-rose-300/80 mb-4">{cameraError}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 rounded-lg bg-rose-900/60 hover:bg-rose-800/60 text-rose-200 border border-rose-700 text-xs font-medium transition-all"
            >
              Retry Camera Access
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
