# Digital Dimension Tracking 📏 AICTE Room Infrastructure Compliance

**Digital Dimension Tracking** is a full-stack web application designed for estimating real-world room dimensions (Length, Width, Height, Floor Area) using a live camera feed and comparing them against AICTE infrastructure requirements in real-time.

It leverages Hugging Face's **Depth Anything V2 Metric Indoor** model (`Depth-Anything-V2-Metric-Indoor-Large-hf`), Open3D 3D point cloud RANSAC geometry segmentation, and OpenCV image processing.

---

## 🌟 Key Features

- **Metric Depth Estimation**: Utilizes Hugging Face Transformers for monocular metric depth prediction in real-world meters.
- **3D Point Cloud Geometry**: Backprojects 2D RGB-D frames into an Open3D 3D Point Cloud to segment floor & wall boundary planes via RANSAC.
- **AICTE Compliance Engine**: Checks measured dimensions against configurable AICTE standards for Classrooms, Computer Labs, Seminar Halls, Workshops, and Cabins.
- **No Fake Measurements**: Incorporates confidence scoring & plane inlier analysis; marks low-confidence readings as `UNRELIABLE` without generating fake numbers.
- **Configurable Standards**: Includes a UI configuration drawer to edit requirement standards in real-time.
- **Modern Dashboard**: Built with React, Vite, Tailwind CSS, Lucide icons, glassmorphic UI, live stream scanlines, and depth map heatmap visualizer.

---

## 🏗️ System Architecture

```text
digital-dimension-tracking/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app & model lifecycle setup
│   │   ├── config.py            # App settings & default AICTE requirements
│   │   ├── api/
│   │   │   ├── health.py        # System health & model readiness endpoint
│   │   │   ├── requirements.py  # AICTE requirements REST API
│   │   │   └── websocket.py     # Real-time /ws/video frame processing
│   │   ├── services/
│   │   │   ├── depth_estimator.py  # Hugging Face Depth-Anything-V2 loader & inference
│   │   │   ├── point_cloud.py      # Open3D 3D point cloud generation
│   │   │   ├── room_measurement.py # RANSAC plane segmentation & room dimension estimator
│   │   │   └── aicte_checker.py    # AICTE compliance evaluator
│   │   └── models/
│   │       └── schemas.py       # Pydantic request/response data schemas
│   ├── requirements.txt
│   └── tests/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── CameraFeed.jsx
│   │   │   ├── MeasurementOverlay.jsx
│   │   │   ├── ComplianceDashboard.jsx
│   │   │   └── ConfigPanel.jsx
│   │   ├── pages/
│   │   │   └── Dashboard.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── websocket.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites

- **Python**: 3.10 or 3.11
- **Node.js**: 18+ and `npm`

---

### 1. Backend Setup

Navigate to the `backend` directory:

```bash
cd backend
```

Create and activate a virtual environment (recommended):

```bash
# On Windows
python -m venv venv
venv\Scripts\activate

# On macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Run the FastAPI backend server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API server will run at `http://localhost:8000`. You can inspect the OpenAPI documentation at `http://localhost:8000/docs`.

---

### 2. Frontend Setup

In a new terminal window, navigate to the `frontend` directory:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📡 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Returns backend readiness & depth model status |
| `/api/requirements` | `GET` | Returns configured AICTE room standards |
| `/api/requirements` | `POST` | Updates AICTE room standard parameters |
| `/ws/video` | `WebSocket` | Real-time camera frame stream & dimension analysis |

---

## 🧪 Running Tests

To execute unit tests for the backend:

```bash
cd backend
pytest tests/
```

To run frontend build checks:

```bash
cd frontend
npm run build
```

---

## ⚠️ AICTE Disclaimer

*The room requirement standards included by default are configurable demo presets. Official institutional AICTE requirements may be customized via the UI Configuration drawer or REST API.*
