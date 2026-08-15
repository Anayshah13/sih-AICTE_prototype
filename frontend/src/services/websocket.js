const getDefaultWsUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return `ws://${window.location.hostname}:8000/ws/video`;
  }
  return 'ws://localhost:8000/ws/video';
};

const WS_URL = import.meta.env.VITE_WS_URL || getDefaultWsUrl();

export class VideoWebSocketService {
  constructor(url = WS_URL) {
    this.url = url;
    this.ws = null;
    this.onMessageCallback = null;
    this.onStatusChangeCallback = null;
    this.isConnected = false;
    this.reconnectTimer = null;
  }

  connect(onMessage, onStatusChange) {
    this.onMessageCallback = onMessage;
    this.onStatusChangeCallback = onStatusChange;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected to:', this.url);
        this.isConnected = true;
        if (this.onStatusChangeCallback) this.onStatusChangeCallback('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onMessageCallback) this.onMessageCallback(data);
        } catch (err) {
          console.error('[WebSocket] Error parsing message JSON:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        if (this.onStatusChangeCallback) this.onStatusChangeCallback('error');
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Connection closed');
        this.isConnected = false;
        if (this.onStatusChangeCallback) this.onStatusChangeCallback('disconnected');
      };
    } catch (err) {
      console.error('[WebSocket] Connection attempt failed:', err);
      if (this.onStatusChangeCallback) this.onStatusChangeCallback('disconnected');
    }
  }

  sendFrame(frameB64, roomType = 'classroom', fx = 500, fy = 500, mode = 'ruler', expectedCm = 15.0, points = null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = {
        frame: frameB64,
        mode,
        expected_cm: expectedCm,
        room_type: roomType,
        points,
        fx,
        fy
      };
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    if (this.onStatusChangeCallback) this.onStatusChangeCallback('disconnected');
  }
}
