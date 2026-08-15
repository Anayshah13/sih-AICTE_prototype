import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from '../components/Header';
import CameraFeed from '../components/CameraFeed';
import MeasurementOverlay from '../components/MeasurementOverlay';
import ComplianceDashboard from '../components/ComplianceDashboard';
import RulerDashboard from '../components/RulerDashboard';
import ConfigPanel from '../components/ConfigPanel';
import { fetchHealth, fetchRequirements } from '../services/api';
import { VideoWebSocketService } from '../services/websocket';

export default function Dashboard() {
  const [mode, setMode] = useState('ruler'); // 'ruler' or 'room'
  const [expectedCm, setExpectedCm] = useState(15.0);

  const [wsStatus, setWsStatus] = useState('disconnected');
  const [depthModelReady, setDepthModelReady] = useState(false);
  const [isTracking, setIsTracking] = useState(true);
  const [selectedRoomType, setSelectedRoomType] = useState('classroom');
  const [roomRequirements, setRoomRequirements] = useState(null);
  
  const [latestDimensions, setLatestDimensions] = useState(null);
  const [latestCompliance, setLatestCompliance] = useState(null);
  const [rulerData, setRulerData] = useState(null);
  const [depthHeatmapB64, setDepthHeatmapB64] = useState(null);
  const [processingTimeMs, setProcessingTimeMs] = useState(0);

  const [selectedPoints, setSelectedPoints] = useState([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const wsServiceRef = useRef(null);

  // Load Initial Requirements and Health Status
  const loadInitialData = useCallback(async () => {
    try {
      const health = await fetchHealth();
      if (health && health.depth_model) {
        setDepthModelReady(health.depth_model.ready);
      }

      const reqData = await fetchRequirements();
      if (reqData && reqData.requirements) {
        setRoomRequirements(reqData.requirements);
      }
    } catch (err) {
      console.error('Error loading initial API data:', err);
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
          if (data.aicte_compliance) setLatestCompliance(data.aicte_compliance);
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
          selectedRoomType,
          500,
          500,
          mode,
          expectedCm,
          points
        );
      }
    },
    [selectedRoomType, mode, expectedCm]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Sticky App Header */}
      <Header
        mode={mode}
        setMode={setMode}
        wsStatus={wsStatus}
        depthModelReady={depthModelReady}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Camera Feed & Live Overlay (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            <div className="h-[460px]">
              <CameraFeed
                onFrameCaptured={handleFrameCaptured}
                depthHeatmapB64={
                  mode === 'ruler' && rulerData?.annotated_frame_b64
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

            <div className="h-[280px]">
              <MeasurementOverlay
                dimensions={
                  mode === 'ruler' && rulerData
                    ? {
                        length_m: rulerData.measured_cm ? rulerData.measured_cm / 100.0 : null,
                        width_m: null,
                        height_m: null,
                        area_sqm: null,
                        confidence: rulerData.confidence,
                        reliable: rulerData.reliable,
                        notes: rulerData.notes
                      }
                    : latestDimensions
                }
                processingTimeMs={processingTimeMs}
              />
            </div>
          </div>

          {/* Right Column: Dynamic Dashboard depending on Mode (5 cols) */}
          <div className="lg:col-span-5 h-[766px]">
            {mode === 'ruler' ? (
              <RulerDashboard
                rulerData={rulerData}
                selectedPoints={selectedPoints}
                setSelectedPoints={setSelectedPoints}
              />
            ) : (
              <ComplianceDashboard
                compliance={latestCompliance}
                roomRequirements={roomRequirements}
                selectedRoomType={selectedRoomType}
                setSelectedRoomType={setSelectedRoomType}
              />
            )}
          </div>

        </div>

      </main>

      {/* Configuration Drawer Modal */}
      <ConfigPanel
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        roomRequirements={roomRequirements}
        selectedRoomType={selectedRoomType}
        onRequirementUpdated={loadInitialData}
      />

    </div>
  );
}
