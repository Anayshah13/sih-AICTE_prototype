# AR Ruler

WebXR AR tape measure for **Android Chrome**. Tap two real-world points and read the Euclidean distance from ARCore world coordinates.

This is **not** a camera overlay, OpenCV demo, or simulated ruler. If `immersive-ar` is unavailable, the app reports that clearly and does not fall back to a fake 3D scene.

## Requirements

- ARCore-compatible Android phone (target: **Nothing Phone (2a)** — on [Google’s ARCore device list](https://developers.google.com/ar/devices))
- **Google Chrome** (not Samsung Internet, Firefox, or iOS Safari)
- **Google Play Services for AR** installed
- A **secure context**: HTTPS or `localhost`

Desktop browsers cannot run this. Chrome on a PC will show `immersive-ar: no`. That is expected.

## Run locally

```bash
cd ar-ruler
npm install
npm run dev
```

The Vite server uses HTTPS and binds to the LAN (`host: true`).

### Option A — USB port forwarding (most reliable)

`localhost` is a trusted secure context, so you avoid self-signed certificate warnings.

1. Enable Developer options and USB debugging on the phone.
2. Connect the Nothing Phone (2a) over USB.
3. On the laptop, open `chrome://inspect#devices` and enable port forwarding: `5173` → `localhost:5173`.
4. On the phone, open Chrome to `https://localhost:5173`.

### Option B — LAN HTTPS

1. Note the Network URL Vite prints, e.g. `https://192.168.x.x:5173`.
2. Open that URL in Chrome on the phone.
3. Accept the self-signed certificate (Advanced → proceed).
4. Confirm the landing page **Device check** shows `immersive-ar: yes` before tapping **Start Measuring**.

## Production build

```bash
npm run build
npm run preview
```

`preview` is also HTTPS. Host the `dist/` folder on any HTTPS static host for a real deploy.

## First-run check on the phone

Before measuring, confirm WebXR itself works:

1. Open [the official hit-test sample](https://immersive-web.github.io/webxr-samples/hit-test.html) in Chrome.
2. If that page cannot start AR, this app cannot either. Install **Google Play Services for AR** and retry.

This app’s landing screen runs the same class of check: `navigator.xr` + `isSessionSupported('immersive-ar')`.

## How measurement works

1. `navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test', 'dom-overlay'] })`
2. Hit-test from the **viewer** reference space (screen-center ray)
3. Point A and B are WebXR hit poses in world space
4. Distance:

```
sqrt( (Bx-Ax)^2 + (By-Ay)^2 + (Bz-Az)^2 )
```

Display: under 100 cm → centimeters; otherwise meters. The stored value is always meters.

AR measurements are approximate.
