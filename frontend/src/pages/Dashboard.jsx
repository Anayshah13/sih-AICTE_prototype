import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from '../components/Header';
import CameraFeed from '../components/CameraFeed';
import MeasurementOverlay from '../components/MeasurementOverlay';
import { fetchHealth } from '../services/api';
import { VideoWebSocketService } from '../services/websocket';

export default function Dashboard() {
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [depthModelReady, setDepthModelReady] = useState(false);
  const [isTracking, setIsTracking] = useState(true);
  
  const [latestDimensions, setLatestDimensions] = useState(null);
  const [rulerData, setRulerData] = useState(null);
  const [depthHeatmapB64, setDepthHeatmapB64] = useState(null);
  const [processingTimeMs, setProcessingTimeMs] = useState(0);

  const [selectedPoints, setSelectedPoints] = useState([]);

  const wsServiceRef = useRef(null);

  // Load Initial Health Status
  const loadInitialData = useCallback(async () => {
    try {
      const health = await fetchHealth();
      if (health && health.depth_model) {
        setDepthModelReady(health.depth_model.ready);
      }
    } catch (err) {
      console.error('Error loading initial API health status:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();

    // Poll health status every 4 seconds until model is ready
    const healthInterval = setInterval(async () => {
      try {
        const health = await fetchHealth();
        if (health && health.depth_model) {
          setDepthModelReady(health.depth_model.ready);
        }
      } catch (e) {
        // ignore
      }
    }, 4000);

    // Initialize WebSocket Connection
    const ws = new VideoWebSocketService();
    wsServiceRef.current = ws;

    ws.connect(
      (data) => {
        if (data.status === 'success') {
          if (data.ruler_measurement) setRulerData(data.ruler_measurement);
          if (data.dimensions) setLatestDimensions(data.dimensions);
          if (data.depth_heatmap_b64) setDepthHeatmapB64(data.depth_heatmap_b64);
          if (data.processing_time_ms) setProcessingTimeMs(data.processing_time_ms);
        }
      },
      (status) => {
        setWsStatus(status);
      }
    );

    return () => {
      clearInterval(healthInterval);
      ws.disconnect();
    };
  }, [loadInitialData]);

  // Handle frame capture from camera
  const handleFrameCaptured = useCallback(
    (frameB64, points = null) => {
      if (wsServiceRef.current) {
        wsServiceRef.current.sendFrame(
          frameB64,
          'classroom',
          500,
          500,
          'ruler',
          15.0,
          points
        );
      }
    },
    []
  );

  // Derive measurements for Live Room Measurements overlay
  const roomLength = latestDimensions?.length_m ?? (rulerData?.measured_cm ? rulerData.measured_cm / 100.0 : null);
  const roomWidth = latestDimensions?.width_m ?? null;
  const ceilingHeight = latestDimensions?.height_m ?? null;
  const floorArea = (roomLength !== null && roomLength !== undefined && roomWidth !== null && roomWidth !== undefined)
    ? Number((roomLength * roomWidth).toFixed(2))
    : (latestDimensions?.area_sqm ?? null);

  const roomDimensions = {
    length_m: roomLength,
    width_m: roomWidth,
    height_m: ceilingHeight,
    area_sqm: floorArea,
    notes: latestDimensions?.notes ?? rulerData?.notes ?? []
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Sticky App Header */}
      <Header
        wsStatus={wsStatus}
        depthModelReady={depthModelReady}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Camera Feed */}
        <div className="h-[460px] w-full">
          <CameraFeed
            onFrameCaptured={handleFrameCaptured}
            depthHeatmapB64={
              rulerData?.annotated_frame_b64
                ? `data:image/jpeg;base64,${rulerData.annotated_frame_b64}`
                : depthHeatmapB64
            }
            isTracking={isTracking}
            setIsTracking={setIsTracking}
            wsStatus={wsStatus}
            selectedPoints={selectedPoints}
            setSelectedPoints={setSelectedPoints}
          />
        </div>

        {/* Live Room Measurements Overlay */}
        <div className="min-h-[260px] w-full">
          <MeasurementOverlay
            dimensions={roomDimensions}
            processingTimeMs={processingTimeMs}
          />
        </div>

      </main>

    </div>
  );
}
