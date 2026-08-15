const $ = (id) => document.getElementById(id);
const errEl = $("err");
const video = $("cam");
const canvas = $("hud");
const ctx = canvas.getContext("2d");

const state = {
  stream: null,
  pose: null,
  mode: "tape",
  points: [],
  busy: false,
  lastFrame: 0,
};

function showErr(msg) {
  errEl.hidden = !msg;
  errEl.textContent = msg || "";
}

function isSecure() {
  return location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

if (!isSecure()) $("https-warn").hidden = false;

fetch("/api/info")
  .then((r) => r.json())
  .then((d) => {
    const el = $("phone-url");
    if (!el) return;
    const url = `${location.protocol}//${d.lan_ip}:5000`;
    el.innerHTML = `Phone, same Wi-Fi: <strong>${url}</strong><br>If the browser warns about the certificate, tap Advanced → continue. Then start the camera.`;
  })
  .catch(() => {});

async function detectXR() {
  try {
    if (navigator.xr && (await navigator.xr.isSessionSupported("immersive-ar"))) {
      $("start-xr").classList.remove("hidden");
    }
  } catch {
    /* no WebXR */
  }
}
detectXR();

document.querySelectorAll(".mode").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode").forEach((b) => b.classList.remove("on"));
    btn.classList.add("on");
    state.mode = btn.dataset.mode;
    state.points = [];
    $("live-read").textContent = "";
    coach();
    updateCommit();
  });
});

function coach() {
  const n = state.points.length;
  const lines = {
    tape: ["Tap point A on the table/floor plane.", "Tap point B. Orbit the phone — the line stays in 3D."],
    height: ["Tap the BASE on the plane.", "Tap the TOP. Height is the vertical 3D distance."],
    room: [
      "Floor corner 1.",
      "Floor corner 2.",
      "Floor corner 3.",
      "Floor corner 4 around the boundary.",
      "Tap the TOP of a wall for height.",
    ],
  };
  $("coach").textContent = state.pose ? lines[state.mode][Math.min(n, lines[state.mode].length - 1)] : "Point at the printed square until XYZ axes lock.";
}

$("start-cam").addEventListener("click", startCamera);

async function startCamera() {
  showErr("");
  if (!isSecure()) {
    showErr("Phone camera is blocked on plain HTTP. Open the HTTPS link printed on the laptop (trycloudflare.com), not 192.168…");
    return;
  }
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch (err) {
    showErr("Camera denied: " + (err.message || err));
    return;
  }
  video.srcObject = state.stream;
  await video.play();
  $("gate").hidden = true;
  $("rig").hidden = false;
  fitCanvas();
  loop();
}

function fitCanvas() {
  canvas.width = video.videoWidth || window.innerWidth;
  canvas.height = video.videoHeight || window.innerHeight;
}

function loop() {
  requestAnimationFrame(loop);
  draw();
  const now = performance.now();
  if (now - state.lastFrame < 160 || state.busy) return;
  state.lastFrame = now;
  sendPose();
}

async function sendPose() {
  if (!video.videoWidth) return;
  state.busy = true;
  try {
    const blob = await grabFrame(640);
    const fd = new FormData();
    fd.append("image", blob, "frame.jpg");
    fd.append("marker_cm", $("marker-cm").value || "10");
    const res = await fetch("/api/pose", { method: "POST", body: fd });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "pose failed");
    state.pose = data.found ? data : null;
    $("lock").textContent = data.found ? "6DoF LOCK" : "SEARCHING MARKER";
    $("lock").classList.toggle("on", !!data.found);
    $("pose-meta").textContent = data.found ? `CAM ${data.cam_dist_cm} cm  ·  HEIGHT ${data.cam_height_cm} cm` : "";
    coach();
  } catch (err) {
    $("lock").textContent = "POSE ERROR";
    $("lock").classList.remove("on");
    showErr(err.message || String(err));
  } finally {
    state.busy = false;
  }
}

function grabFrame(maxW) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.min(1, maxW / vw);
  const off = document.createElement("canvas");
  off.width = Math.round(vw * scale);
  off.height = Math.round(vh * scale);
  off.getContext("2d").drawImage(video, 0, 0, off.width, off.height);
  return new Promise((resolve) => off.toBlob(resolve, "image/jpeg", 0.72));
}

function eventToVideoPx(ev) {
  const rect = canvas.getBoundingClientRect();
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(rect.width / vw, rect.height / vh);
  const ox = (rect.width - vw * scale) / 2;
  const oy = (rect.height - vh * scale) / 2;
  return { u: (ev.clientX - rect.left - ox) / scale, v: (ev.clientY - rect.top - oy) / scale };
}

function toPoseUV(uVid, vVid) {
  return {
    u: (uVid / video.videoWidth) * state.pose.width,
    v: (vVid / video.videoHeight) * state.pose.height,
  };
}

function transpose(M) {
  return [0, 1, 2].map((i) => [M[0][i], M[1][i], M[2][i]]);
}

function mulMatVec(M, v) {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}

function camCenter(R, t) {
  return mulMatVec(transpose(R), t.map((x) => -x));
}

function pixelRay(u, v, pose) {
  const K = pose.K;
  const fx = K[0][0];
  const fy = K[1][1];
  const cx = K[0][2];
  const cy = K[1][2];
  let d = [(u - cx) / fx, (v - cy) / fy, 1];
  const n = Math.hypot(d[0], d[1], d[2]);
  d = d.map((x) => x / n);
  const Rt = transpose(pose.R);
  return { origin: camCenter(pose.R, pose.t), dir: mulMatVec(Rt, d) };
}

function intersectFloor(origin, dir) {
  if (Math.abs(dir[2]) < 1e-8) throw new Error("Ray is parallel to the marker plane.");
  const s = -origin[2] / dir[2];
  if (s < 0) throw new Error("That tap does not hit the plane in front of the camera.");
  return [origin[0] + s * dir[0], origin[1] + s * dir[1], origin[2] + s * dir[2]];
}

function heightOnVertical(origin, dir, base) {
  const A = [
    [dir[0], 0],
    [dir[1], 0],
    [dir[2], -1],
  ];
  const b = [base[0] - origin[0], base[1] - origin[1], -origin[2]];
  const AtA00 = A[0][0] * A[0][0] + A[1][0] * A[1][0] + A[2][0] * A[2][0];
  const AtA01 = A[0][0] * A[0][1] + A[1][0] * A[1][1] + A[2][0] * A[2][1];
  const AtA11 = A[0][1] * A[0][1] + A[1][1] * A[1][1] + A[2][1] * A[2][1];
  const Atb0 = A[0][0] * b[0] + A[1][0] * b[1] + A[2][0] * b[2];
  const Atb1 = A[0][1] * b[0] + A[1][1] * b[1] + A[2][1] * b[2];
  const det = AtA00 * AtA11 - AtA01 * AtA01;
  if (Math.abs(det) < 1e-12) throw new Error("Cannot solve height from this angle. Move sideways.");
  const tRay = (AtA11 * Atb0 - AtA01 * Atb1) / det;
  const h = (-AtA01 * Atb0 + AtA00 * Atb1) / det;
  if (tRay < 0) throw new Error("Height tap is behind the camera.");
  return { point: [base[0], base[1], h], height: h };
}

function projectWorld(xyz, pose) {
  const Xc = mulMatVec(pose.R, xyz).map((v, i) => v + pose.t[i]);
  if (Xc[2] <= 0.1) return null;
  const u = pose.K[0][0] * (Xc[0] / Xc[2]) + pose.K[0][2];
  const v = pose.K[1][1] * (Xc[1] / Xc[2]) + pose.K[1][2];
  return poseToCanvas(u, v, pose);
}

function poseToCanvas(u, v, pose) {
  return [(u / pose.width) * canvas.width, (v / pose.height) * canvas.height];
}

function dist3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function needed() {
  if (state.mode === "tape") return 2;
  if (state.mode === "height") return 2;
  return 5;
}

function nextKind() {
  const n = state.points.length;
  if (state.mode === "tape") return n < 2 ? "floor" : null;
  if (state.mode === "height") return n === 0 ? "floor" : n === 1 ? "height" : null;
  if (n < 4) return "floor";
  if (n === 4) return "height";
  return null;
}

canvas.addEventListener("click", (ev) => {
  if (!state.pose) {
    showErr("Wait for 6DoF LOCK — keep the marker in view.");
    return;
  }
  const kind = nextKind();
  if (!kind) return;
  try {
    const vid = eventToVideoPx(ev);
    const { u, v } = toPoseUV(vid.u, vid.v);
    const ray = pixelRay(u, v, state.pose);
    let world;
    if (kind === "floor") {
      world = intersectFloor(ray.origin, ray.dir);
    } else {
      const base = [...state.points].reverse().find((p) => p.kind === "floor");
      if (!base) throw new Error("Tap a base point on the plane first.");
      const solved = heightOnVertical(ray.origin, ray.dir, base.world);
      world = solved.point;
    }
    state.points.push({ kind, world });
    showErr("");
    preview();
    coach();
    updateCommit();
  } catch (err) {
    showErr(err.message || String(err));
  }
});

function preview() {
  const pts = state.points;
  if (state.mode === "tape" && pts.length === 2) {
    const d = dist3(pts[0].world, pts[1].world);
    $("live-read").textContent = `${d.toFixed(1)} cm   ·   ${(d / 100).toFixed(3)} m`;
  } else if (state.mode === "height" && pts.length === 2) {
    const h = Math.abs(pts[1].world[2] - pts[0].world[2]);
    $("live-read").textContent = `H  ${h.toFixed(1)} cm   ·   ${(h / 100).toFixed(3)} m`;
  } else if (state.mode === "room" && pts.length === 5) {
    $("live-read").textContent = "5 points locked — Compute for L × W × H";
  } else {
    $("live-read").textContent = "";
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!state.pose) return;
  const pose = state.pose;
  const map = (pt) => poseToCanvas(pt[0], pt[1], pose);

  ctx.strokeStyle = "rgba(200,245,66,0.2)";
  ctx.lineWidth = 1;
  pose.grid.forEach((seg) => {
    const a = map(seg[0]);
    const b = map(seg[1]);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  });

  const origin = map(pose.axis[0]);
  [
    { pt: map(pose.axis[1]), color: "#ff5a3c", label: "X" },
    { pt: map(pose.axis[2]), color: "#c8f542", label: "Y" },
    { pt: map(pose.axis[3]), color: "#5ce1ff", label: "Z" },
  ].forEach((ax) => {
    ctx.strokeStyle = ax.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(origin[0], origin[1]);
    ctx.lineTo(ax.pt[0], ax.pt[1]);
    ctx.stroke();
    ctx.fillStyle = ax.color;
    ctx.font = "16px IBM Plex Mono";
    ctx.fillText(ax.label, ax.pt[0] + 6, ax.pt[1]);
  });

  ctx.strokeStyle = "#c8f542";
  ctx.lineWidth = 3;
  ctx.beginPath();
  pose.corners.forEach((c, i) => {
    const p = map(c);
    if (i === 0) ctx.moveTo(p[0], p[1]);
    else ctx.lineTo(p[0], p[1]);
  });
  ctx.closePath();
  ctx.stroke();

  const projected = state.points.map((p) => projectWorld(p.world, pose));
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ff6a1a";
  ctx.beginPath();
  projected.forEach((p, i) => {
    if (!p) return;
    if (i === 0) ctx.moveTo(p[0], p[1]);
    else ctx.lineTo(p[0], p[1]);
  });
  if (state.mode === "room" && projected.length >= 4 && projected[0] && projected[3]) {
    ctx.lineTo(projected[0][0], projected[0][1]);
  }
  ctx.stroke();

  state.points.forEach((pt, i) => {
    const p = projected[i];
    if (!p) return;
    ctx.fillStyle = pt.kind === "height" ? "#5ce1ff" : "#ff6a1a";
    ctx.beginPath();
    ctx.arc(p[0], p[1], 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#12150c";
    ctx.font = "bold 14px IBM Plex Mono";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), p[0], p[1]);
  });
  ctx.textAlign = "start";
}

function updateCommit() {
  $("commit").disabled = state.points.length !== needed();
}

$("undo").addEventListener("click", () => {
  state.points.pop();
  preview();
  coach();
  updateCommit();
});

$("clear").addEventListener("click", () => {
  state.points = [];
  $("live-read").textContent = "";
  coach();
  updateCommit();
});

$("commit").addEventListener("click", async () => {
  if (!state.pose) return;
  $("commit").disabled = true;
  try {
    const taps = state.points.map((p) => {
      const uv = projectWorld(p.world, state.pose);
      const u = (uv[0] / canvas.width) * state.pose.width;
      const v = (uv[1] / canvas.height) * state.pose.height;
      return { u, v, kind: p.kind };
    });
    const res = await fetch("/api/measure3d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: state.mode, K: state.pose.K, R: state.pose.R, t: state.pose.t, taps }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    $("live-read").textContent = formatResult(data);
  } catch (err) {
    showErr(err.message || String(err));
  } finally {
    updateCommit();
  }
});

function formatResult(data) {
  if (data.mode === "tape") return `${data.length_cm} cm   ·   ${data.length_m} m`;
  if (data.mode === "height") return `H  ${data.height_cm} cm   ·   ${data.height_m} m`;
  return `L ${data.length_m} m   W ${data.width_m} m   H ${data.height_m} m\n${data.area_m2} m²   ·   ${data.volume_m3} m³`;
}

$("start-xr").addEventListener("click", startWebXR);

async function startWebXR() {
  showErr("");
  try {
    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test", "dom-overlay"],
      domOverlay: { root: document.body },
    });
    await runHitTestSession(session);
  } catch (err) {
    showErr("World AR needs Chrome on Android. Use live 3D camera + printed marker on iPhone.");
  }
}

async function runHitTestSession(session) {
  const glCanvas = document.createElement("canvas");
  const gl = glCanvas.getContext("webgl", { xrCompatible: true });
  await gl.makeXRCompatible();
  session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
  const ref = await session.requestReferenceSpace("local");
  const viewer = await session.requestReferenceSpace("viewer");
  const source = await session.requestHitTestSource({ space: viewer });
  const xrPts = [];
  $("gate").hidden = true;
  $("rig").hidden = false;
  $("coach").textContent = "World AR locked. Tap two real surfaces for a 3D tape.";
  $("lock").textContent = "WEBXR WORLD TRACK";
  $("lock").classList.add("on");
  canvas.addEventListener("click", () => {
    state._xrTap = true;
  });
  session.requestAnimationFrame(function onXR(_t, frame) {
    session.requestAnimationFrame(onXR);
    if (!frame.getViewerPose(ref)) return;
    const hits = frame.getHitTestResults(source);
    if (state._xrTap && hits.length) {
      state._xrTap = false;
      const p = hits[0].getPose(ref).transform.position;
      xrPts.push({ x: p.x, y: p.y, z: p.z });
      if (xrPts.length >= 2) {
        const a = xrPts[xrPts.length - 2];
        const b = xrPts[xrPts.length - 1];
        const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        $("live-read").textContent = `${(d * 100).toFixed(1)} cm   ·   ${d.toFixed(3)} m`;
      }
    }
  });
}

window.addEventListener("resize", () => {
  if (video.srcObject) fitCanvas();
});
