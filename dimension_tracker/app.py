"""
Live 3D dimension tracker for AICTE infrastructure verification.

A printed ArUco marker of known size is the world origin. The phone camera
pose is recovered every frame with solvePnP (6DoF). Taps become 3D rays
that hit the marker plane (floor/table) or a vertical line (height).
"""

from __future__ import annotations

import io
import json
import socket
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, jsonify, render_template, request, send_file
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
STATIC.mkdir(exist_ok=True)

ARUCO_DICT_NAME = cv2.aruco.DICT_4X4_50
ARUCO_ID = 0
DEFAULT_MARKER_CM = 10.0
DEFAULT_FOV_DEG = 62.0

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024


def _aruco_dictionary():
    return cv2.aruco.getPredefinedDictionary(ARUCO_DICT_NAME)


def _detector():
    dictionary = _aruco_dictionary()
    try:
        params = cv2.aruco.DetectorParameters()
    except AttributeError:
        params = cv2.aruco.DetectorParameters_create()
    try:
        params.minMarkerPerimeterRate = 0.02
        params.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_SUBPIX
    except Exception:
        pass
    try:
        return cv2.aruco.ArucoDetector(dictionary, params), dictionary
    except AttributeError:
        return None, dictionary


def detect_aruco(gray: np.ndarray):
    detector, dictionary = _detector()
    if detector is not None:
        corners, ids, _ = detector.detectMarkers(gray)
    else:
        try:
            params = cv2.aruco.DetectorParameters()
        except AttributeError:
            params = cv2.aruco.DetectorParameters_create()
        corners, ids, _ = cv2.aruco.detectMarkers(gray, dictionary, parameters=params)
    if ids is None or len(ids) == 0:
        return None
    return corners[0][0].astype(np.float32)


def camera_matrix(width: int, height: int, fov_deg: float = DEFAULT_FOV_DEG) -> np.ndarray:
    fx = (width / 2.0) / np.tan(np.deg2rad(fov_deg) / 2.0)
    fy = fx
    return np.array([[fx, 0, width / 2.0], [0, fy, height / 2.0], [0, 0, 1]], dtype=np.float64)


def marker_object_points(marker_cm: float) -> np.ndarray:
    h = marker_cm / 2.0
    return np.array(
        [[-h, h, 0], [h, h, 0], [h, -h, 0], [-h, -h, 0]],
        dtype=np.float32,
    )


def solve_pose(corners: np.ndarray, marker_cm: float, K: np.ndarray):
    obj = marker_object_points(marker_cm)
    ok, rvec, tvec = cv2.solvePnP(obj, corners, K, None, flags=cv2.SOLVEPNP_IPPE_SQUARE)
    if not ok:
        ok, rvec, tvec = cv2.solvePnP(obj, corners, K, None)
    if not ok:
        raise ValueError("Could not recover camera pose from the marker.")
    R, _ = cv2.Rodrigues(rvec)
    t = tvec.reshape(3)
    return R, t, rvec, tvec


def camera_center(R: np.ndarray, t: np.ndarray) -> np.ndarray:
    return (-R.T @ t).reshape(3)


def pixel_ray(u: float, v: float, K: np.ndarray, R: np.ndarray, t: np.ndarray):
    fx, fy = K[0, 0], K[1, 1]
    cx, cy = K[0, 2], K[1, 2]
    dir_cam = np.array([(u - cx) / fx, (v - cy) / fy, 1.0], dtype=np.float64)
    dir_cam /= np.linalg.norm(dir_cam)
    origin = camera_center(R, t)
    direction = R.T @ dir_cam
    direction /= np.linalg.norm(direction)
    return origin, direction


def intersect_floor(origin: np.ndarray, direction: np.ndarray) -> np.ndarray:
    if abs(direction[2]) < 1e-8:
        raise ValueError("Ray is parallel to the marker plane.")
    scale = -origin[2] / direction[2]
    if scale < 0:
        raise ValueError("That tap does not hit the marker plane in front of the camera.")
    return origin + scale * direction


def height_on_vertical(origin: np.ndarray, direction: np.ndarray, base: np.ndarray) -> tuple[np.ndarray, float]:
    """Second tap: intersect the camera ray with the vertical line through a floor point."""
    a = np.array([[direction[0], 0.0], [direction[1], 0.0], [direction[2], -1.0]], dtype=np.float64)
    b = np.array([base[0] - origin[0], base[1] - origin[1], 0.0 - origin[2]], dtype=np.float64)
    sol, *_ = np.linalg.lstsq(a, b, rcond=None)
    t_ray, h = float(sol[0]), float(sol[1])
    if t_ray < 0:
        raise ValueError("Height tap is behind the camera. Move so you can see the top and the marker.")
    point = np.array([base[0], base[1], h], dtype=np.float64)
    return point, h


def project_points(points_cm: np.ndarray, rvec, tvec, K) -> list:
    pts = np.asarray(points_cm, dtype=np.float32).reshape(-1, 1, 3)
    img, _ = cv2.projectPoints(pts, rvec, tvec, K, None)
    return img.reshape(-1, 2).tolist()


def load_image(file_storage) -> np.ndarray:
    raw = file_storage.read()
    pil = Image.open(io.BytesIO(raw))
    pil = ImageOps.exif_transpose(pil)
    if pil.mode != "RGB":
        pil = pil.convert("RGB")
    return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)


def parse_json(raw, default):
    if raw in (None, ""):
        return default
    if isinstance(raw, (list, dict)):
        return raw
    return json.loads(raw)


def pairwise_distances(world: np.ndarray) -> list[float]:
    n = len(world)
    return [float(np.linalg.norm(world[(i + 1) % n] - world[i])) for i in range(n)]


def shoelace_area_xy(world: np.ndarray) -> float:
    x, y = world[:, 0], world[:, 1]
    return float(0.5 * np.abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1))))


def generate_marker_png(marker_cm: float = DEFAULT_MARKER_CM) -> bytes:
    dpi = 300
    px = int(round(marker_cm / 2.54 * dpi))
    dictionary = _aruco_dictionary()
    try:
        marker = cv2.aruco.generateImageMarker(dictionary, ARUCO_ID, px)
    except AttributeError:
        marker = cv2.aruco.drawMarker(dictionary, ARUCO_ID, px)

    quiet = int(px * 0.18)
    canvas_w = px + 2 * quiet
    header, footer = 150, 170
    canvas_h = canvas_w + header + footer
    page = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8) * 255
    page[header + quiet : header + quiet + px, quiet : quiet + px, 0] = marker
    page[header + quiet : header + quiet + px, quiet : quiet + px, 1] = marker
    page[header + quiet : header + quiet + px, quiet : quiet + px, 2] = marker

    pil = Image.fromarray(page)
    draw = ImageDraw.Draw(pil)
    try:
        title_font = ImageFont.truetype("arial.ttf", 34)
        body_font = ImageFont.truetype("arial.ttf", 20)
        small_font = ImageFont.truetype("arial.ttf", 16)
    except OSError:
        title_font = body_font = small_font = ImageFont.load_default()

    draw.text((20, 20), "AICTE 3D WORLD ORIGIN", fill=(20, 20, 20), font=title_font)
    draw.text(
        (20, 70),
        f"PRINT AT 100%  ·  DO NOT FIT TO PAGE  ·  BLACK SQUARE = {marker_cm:.0f} cm",
        fill=(80, 80, 80),
        font=body_font,
    )
    y = header + canvas_w - quiet + 12
    draw.text((20, y), f"ArUco 4×4  ID {ARUCO_ID}  ·  {marker_cm:.0f}×{marker_cm:.0f} cm", fill=(20, 20, 20), font=body_font)
    draw.text((20, y + 32), "Place FLAT on the floor or table. This square is (0,0,0) in 3D.", fill=(80, 80, 80), font=small_font)
    draw.text((20, y + 56), "Keep it visible while you measure length, width, and height.", fill=(80, 80, 80), font=small_font)
    bar_y = y + 100
    draw.line([(quiet, bar_y), (quiet + px, bar_y)], fill=(20, 20, 20), width=3)
    draw.line([(quiet, bar_y - 8), (quiet, bar_y + 8)], fill=(20, 20, 20), width=3)
    draw.line([(quiet + px, bar_y - 8), (quiet + px, bar_y + 8)], fill=(20, 20, 20), width=3)
    draw.text((quiet + px // 2 - 36, bar_y - 26), f"{marker_cm:.0f} cm", fill=(20, 20, 20), font=body_font)

    out = io.BytesIO()
    pil.save(out, format="PNG", dpi=(dpi, dpi))
    return out.getvalue()


def pose_payload(bgr, marker_cm: float, fov_deg: float):
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    corners = detect_aruco(gray)
    h, w = bgr.shape[:2]
    if corners is None:
        return {"ok": True, "found": False, "width": w, "height": h}

    K = camera_matrix(w, h, fov_deg)
    R, t, rvec, tvec = solve_pose(corners, marker_cm, K)
    axis_len = marker_cm
    axis_3d = np.array(
        [[0, 0, 0], [axis_len, 0, 0], [0, axis_len, 0], [0, 0, axis_len]],
        dtype=np.float32,
    )
    axis_2d = project_points(axis_3d, rvec, tvec, K)
    grid = []
    step = marker_cm
    for i in range(-4, 5):
        grid.append([[i * step, -4 * step, 0], [i * step, 4 * step, 0]])
        grid.append([[-4 * step, i * step, 0], [4 * step, i * step, 0]])
    grid_2d = [project_points(np.array(seg, np.float32), rvec, tvec, K) for seg in grid]
    cam = camera_center(R, t)

    return {
        "ok": True,
        "found": True,
        "width": w,
        "height": h,
        "marker_cm": marker_cm,
        "K": K.tolist(),
        "R": R.tolist(),
        "t": t.tolist(),
        "corners": corners.tolist(),
        "axis": axis_2d,
        "grid": grid_2d,
        "cam_dist_cm": round(float(np.linalg.norm(t)), 1),
        "cam_height_cm": round(float(cam[2]), 1),
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/info")
def api_info():
    return jsonify({"ok": True, "lan_ip": lan_ip(), "port": 5000})


@app.route("/marker.png")
def marker():
    cm = float(request.args.get("cm", DEFAULT_MARKER_CM))
    png = generate_marker_png(cm)
    return send_file(io.BytesIO(png), mimetype="image/png", download_name=f"aicte_marker_{cm:.0f}cm.png")


@app.route("/api/pose", methods=["POST"])
def api_pose():
    if "image" not in request.files:
        return jsonify({"ok": False, "error": "No frame."}), 400
    try:
        bgr = load_image(request.files["image"])
        marker_cm = float(request.form.get("marker_cm", DEFAULT_MARKER_CM))
        fov_deg = float(request.form.get("fov_deg", DEFAULT_FOV_DEG))
        return jsonify(pose_payload(bgr, marker_cm, fov_deg))
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@app.route("/api/measure3d", methods=["POST"])
def api_measure3d():
    try:
        data = request.get_json(force=True)
        K = np.array(data["K"], dtype=np.float64)
        R = np.array(data["R"], dtype=np.float64)
        t = np.array(data["t"], dtype=np.float64)
        taps = data.get("taps", [])
        mode = data.get("mode", "tape")

        floors, heights = [], []
        for tap in taps:
            origin, direction = pixel_ray(tap["u"], tap["v"], K, R, t)
            kind = tap.get("kind", "floor")
            if kind == "floor":
                floors.append(intersect_floor(origin, direction))
            elif kind == "height":
                if not floors:
                    raise ValueError("Tap a floor/base point before the top.")
                pt, h = height_on_vertical(origin, direction, floors[-1])
                heights.append({"point": pt.tolist(), "height_cm": h})
            else:
                raise ValueError("Unknown tap kind.")

        result = {"ok": True, "mode": mode, "floor_points": [p.tolist() for p in floors]}

        if mode == "tape":
            if len(floors) != 2:
                raise ValueError("Tape measure needs 2 taps on the surface.")
            d = float(np.linalg.norm(floors[1] - floors[0]))
            result["length_cm"] = round(d, 2)
            result["length_m"] = round(d / 100.0, 3)
            result["p1"] = floors[0].tolist()
            result["p2"] = floors[1].tolist()

        elif mode == "height":
            if len(floors) < 1 or not heights:
                raise ValueError("Height needs a base tap on the plane, then a tap on the top.")
            h = abs(heights[-1]["height_cm"])
            result["height_cm"] = round(h, 2)
            result["height_m"] = round(h / 100.0, 3)
            result["base"] = floors[-1].tolist()
            result["top"] = heights[-1]["point"]

        elif mode == "room":
            if len(floors) != 4:
                raise ValueError("Room needs 4 floor corners in order around the boundary.")
            if not heights:
                raise ValueError("Tap the top of a wall / ceiling after the 4 corners to get height.")
            world = np.vstack(floors)
            sides = pairwise_distances(world)
            length = (sides[0] + sides[2]) / 2.0
            width = (sides[1] + sides[3]) / 2.0
            area = shoelace_area_xy(world)
            height = abs(heights[-1]["height_cm"])
            result.update(
                {
                    "length_cm": round(length, 2),
                    "width_cm": round(width, 2),
                    "height_cm": round(height, 2),
                    "length_m": round(length / 100.0, 3),
                    "width_m": round(width / 100.0, 3),
                    "height_m": round(height / 100.0, 3),
                    "area_m2": round(area / 10_000.0, 3),
                    "volume_m3": round((area / 10_000.0) * (height / 100.0), 3),
                    "sides_cm": [round(s, 2) for s in sides],
                }
            )
        else:
            raise ValueError("Mode must be tape, height, or room.")

        return jsonify(result)
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


def lan_ip() -> str:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        return ip
    except OSError:
        return "127.0.0.1"


def ssl_context():
    cert = ROOT / "cert.pem"
    key = ROOT / "key.pem"
    if cert.exists() and key.exists():
        return (str(cert), str(key))
    try:
        import OpenSSL  # noqa: F401

        return "adhoc"
    except ImportError:
        return None


if __name__ == "__main__":
    ip = lan_ip()
    ctx = ssl_context()
    scheme = "https" if ctx else "http"
    print("\n  AICTE 3D Dimension Tracker")
    print("  --------------------------")
    print(f"  Laptop:  {scheme}://127.0.0.1:5000")
    print(f"  Phone:   {scheme}://{ip}:5000")
    if scheme == "https":
        print("  Phone will warn about the certificate — tap Advanced / Visit anyway.")
        print("  Camera only works on HTTPS (or localhost). Do not use http://")
    else:
        print("  WARNING: no TLS. Phone browsers will block the camera on LAN HTTP.")
    print(f"  Marker:  {scheme}://127.0.0.1:5000/marker.png\n")
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True, ssl_context=ctx)
