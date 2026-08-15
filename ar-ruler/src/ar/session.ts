import * as THREE from "three";
import { formatArea, formatDistance, worldDistanceMeters } from "./measure";
import {
  cellKey,
  estimateRoom,
  estimatesClose,
  type PlaneSample,
  type RoomEstimate,
} from "./room";
import {
  createLineVisual,
  createScene,
  disposeScene,
  placeFromMatrix,
  removeLineVisual,
  updateRoomVisual,
} from "./scene";
import type { ArUiState, LineSummary, MeasurePhase } from "./types";
import { INITIAL_UI } from "./types";
import { mapXrError } from "./webxr";

const READY_HIT_FRAMES = 8;
const SAMPLE_EVERY = 3;
const STABLE_FRAMES = 22;

export type SessionCallbacks = {
  overlayRoot: HTMLElement;
  onUi: (state: ArUiState) => void;
  onEnded: () => void;
};

export type ArRulerHandle = {
  undo: () => void;
  deleteLine: (id: number) => void;
  end: () => Promise<void>;
};

type LineRecord = LineSummary & {
  a: THREE.Vector3;
  b: THREE.Vector3;
};

type InternalState = {
  phase: MeasurePhase;
  pending: THREE.Vector3 | null;
  lines: LineRecord[];
  consecutiveHits: number;
  hitValid: boolean;
  tracking: boolean;
  room: RoomEstimate | null;
  roomLocked: boolean;
};

let lineSeq = 1;

export async function startArSession(callbacks: SessionCallbacks): Promise<ArRulerHandle> {
  if (!navigator.xr) {
    throw new Error("WebXR is not available in this browser.");
  }
  lineSeq = 1;

  const { scene, camera, objects } = createScene();
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setFramebufferScaleFactor(0.65);
  renderer.domElement.className = "ar-canvas";
  document.body.appendChild(renderer.domElement);

  callbacks.overlayRoot.dataset.active = "true";
  callbacks.overlayRoot.hidden = false;

  const sessionInit: XRSessionInit = {
    requiredFeatures: ["hit-test", "dom-overlay"],
    optionalFeatures: ["local-floor", "plane-detection"],
    domOverlay: { root: callbacks.overlayRoot },
  };

  let session: XRSession;
  try {
    session = await navigator.xr.requestSession("immersive-ar", sessionInit);
  } catch (error) {
    callbacks.overlayRoot.dataset.active = "false";
    cleanupRenderer(renderer);
    disposeScene(scene, objects);
    throw new Error(mapXrError(error));
  }

  const referenceType = await pickReferenceSpaceType(session);
  renderer.xr.setReferenceSpaceType(referenceType);

  try {
    await renderer.xr.setSession(session);
  } catch (error) {
    callbacks.overlayRoot.dataset.active = "false";
    await session.end().catch(() => undefined);
    cleanupRenderer(renderer);
    disposeScene(scene, objects);
    throw new Error(mapXrError(error));
  }

  callbacks.overlayRoot.dataset.active = "true";

  const internal: InternalState = {
    phase: "scanning",
    pending: null,
    lines: [],
    consecutiveHits: 0,
    hitValid: false,
    tracking: true,
    room: null,
    roomLocked: false,
  };

  const samples: PlaneSample[] = [];
  const seenCells = new Set<string>();
  let sampleTick = 0;
  let lastEstimate: RoomEstimate | null = null;
  let stableFrames = 0;
  let lastRoomKey = "";

  let hitTestSource: XRHitTestSource | null = null;
  let transientSource: XRTransientInputHitTestSource | null = null;
  let ended = false;
  let placedThisTouch = false;

  const planeOrigin = new THREE.Vector3();
  const planeNormal = new THREE.Vector3();
  const plane = new THREE.Plane();
  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const tapPoint = new THREE.Vector3();
  const tapMatrix = new THREE.Matrix4();
  const samplePos = new THREE.Vector3();
  const sampleNrm = new THREE.Vector3();

  const emit = (): void => {
    callbacks.onUi(uiFromInternal(internal));
  };

  emit();

  try {
    const viewerSpace = await session.requestReferenceSpace("viewer");
    hitTestSource = (await session.requestHitTestSource?.({ space: viewerSpace })) ?? null;
    if (!hitTestSource) {
      throw new Error("Hit-testing is not supported. This app will not fake AR with the camera.");
    }
  } catch (error) {
    callbacks.overlayRoot.dataset.active = "false";
    await session.end().catch(() => undefined);
    cleanupRenderer(renderer);
    disposeScene(scene, objects);
    throw new Error(mapXrError(error));
  }

  try {
    transientSource =
      (await session.requestHitTestSourceForTransientInput?.({ profile: "generic-touchscreen" })) ??
      null;
  } catch {
    transientSource = null;
  }

  const canPlace = (): boolean =>
    !ended && internal.tracking && internal.hitValid && internal.phase === "measuring";

  const commitLine = (b: THREE.Vector3): void => {
    const a = internal.pending;
    if (!a) {
      return;
    }
    const meters = worldDistanceMeters(a.x, a.y, a.z, b.x, b.y, b.z);
    if (meters < 0.03) {
      return;
    }
    const id = lineSeq;
    lineSeq += 1;
    const label = formatDistance(meters);
    const visual = createLineVisual(id, a, b, label);
    objects.lines.add(visual.group);
    internal.lines.push({ id, label, meters, a: a.clone(), b: b.clone() });
    internal.pending = null;
    objects.pending.visible = false;
  };

  const placeAtMatrix = (matrix: THREE.Matrix4): void => {
    if (!canPlace()) {
      return;
    }
    const point = new THREE.Vector3().setFromMatrixPosition(matrix);
    if (!internal.pending) {
      internal.pending = placeFromMatrix(objects.pending, matrix);
      emit();
      return;
    }
    commitLine(point);
    emit();
  };

  const placeFromScreen = (clientX: number, clientY: number): boolean => {
    if (!canPlace() || !objects.reticle.visible) {
      return false;
    }

    planeOrigin.setFromMatrixPosition(objects.reticle.matrix);
    planeNormal.setFromMatrixColumn(objects.reticle.matrix, 1).normalize();
    if (planeNormal.lengthSq() < 1e-8) {
      planeNormal.set(0, 1, 0);
    }
    plane.setFromNormalAndCoplanarPoint(planeNormal, planeOrigin);

    ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    const xrCamera = renderer.xr.getCamera();
    const subCam = xrCamera.cameras[0] ?? xrCamera;
    raycaster.setFromCamera(ndc, subCam);
    const hit = raycaster.ray.intersectPlane(plane, tapPoint);
    if (!hit) {
      return false;
    }

    tapMatrix.copy(objects.reticle.matrix);
    tapMatrix.setPosition(tapPoint);
    placeAtMatrix(tapMatrix);
    return true;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("button")) {
      return;
    }
    if (placedThisTouch) {
      return;
    }
    if (placeFromScreen(event.clientX, event.clientY)) {
      placedThisTouch = true;
    }
  };

  const tapSurface = callbacks.overlayRoot.querySelector(".tap-surface");
  tapSurface?.addEventListener("pointerdown", onPointerDown as EventListener);

  const ingestSample = (x: number, y: number, z: number, nx: number, ny: number, nz: number): void => {
    const key = cellKey(x, y, z);
    if (seenCells.has(key)) {
      return;
    }
    seenCells.add(key);
    samples.push({ x, y, z, nx, ny, nz });
  };

  const refreshRoom = (): boolean => {
    const estimate = estimateRoom(samples);
    if (!estimate) {
      return false;
    }

    if (lastEstimate && estimatesClose(lastEstimate, estimate)) {
      stableFrames += 1;
    } else {
      stableFrames = 0;
    }
    lastEstimate = estimate;

    const wasLocked = internal.roomLocked;
    const prevArea = internal.room?.areaM2 ?? 0;
    internal.room = estimate;
    if (estimate.confident && stableFrames >= STABLE_FRAMES) {
      internal.roomLocked = true;
    }

    const key = `${estimate.areaM2.toFixed(1)}:${estimate.heightM.toFixed(1)}:${internal.roomLocked}:${estimate.hasCeiling}`;
    if (estimate.areaM2 >= 2 && key !== lastRoomKey) {
      lastRoomKey = key;
      updateRoomVisual(
        objects.room,
        estimate.hasCeiling ? estimate.corners8 : estimate.floorCorners,
        formatArea(estimate.areaM2),
        internal.roomLocked && estimate.hasCeiling,
      );
    }

    return (
      wasLocked !== internal.roomLocked ||
      Math.abs(estimate.areaM2 - prevArea) > 0.2 ||
      (prevArea === 0 && estimate.areaM2 >= 2)
    );
  };

  const onResize = (): void => {
    if (renderer.xr.isPresenting) {
      return;
    }
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", onResize);

  const teardown = (): void => {
    if (ended) {
      return;
    }
    ended = true;
    hitTestSource?.cancel();
    hitTestSource = null;
    transientSource?.cancel();
    transientSource = null;
    tapSurface?.removeEventListener("pointerdown", onPointerDown as EventListener);
    window.removeEventListener("resize", onResize);
    renderer.setAnimationLoop(null);
    callbacks.overlayRoot.dataset.active = "false";
    cleanupRenderer(renderer);
    disposeScene(scene, objects);
    callbacks.onEnded();
  };

  session.addEventListener("end", teardown);

  renderer.setAnimationLoop((_time, frame) => {
    if (!frame || ended) {
      renderer.render(scene, camera);
      return;
    }

    const referenceSpace = renderer.xr.getReferenceSpace();
    if (!referenceSpace || !hitTestSource) {
      renderer.render(scene, camera);
      return;
    }

    const pose = frame.getViewerPose(referenceSpace);
    const tracking = Boolean(pose);
    let dirty = tracking !== internal.tracking;
    internal.tracking = tracking;

    const hits = frame.getHitTestResults(hitTestSource);
    const hitPose = hits[0] && tracking ? hits[0].getPose(referenceSpace) : null;

    if (hitPose) {
      objects.reticle.visible = true;
      objects.reticle.matrix.fromArray(hitPose.transform.matrix);
      internal.consecutiveHits += 1;
      if (!internal.hitValid) {
        internal.hitValid = true;
        dirty = true;
      }

      if (internal.phase === "scanning" && internal.consecutiveHits >= READY_HIT_FRAMES) {
        internal.phase = "measuring";
        dirty = true;
      }

      sampleTick += 1;
      if (sampleTick % SAMPLE_EVERY === 0) {
        samplePos.setFromMatrixPosition(objects.reticle.matrix);
        sampleNrm.setFromMatrixColumn(objects.reticle.matrix, 1).normalize();
        ingestSample(samplePos.x, samplePos.y, samplePos.z, sampleNrm.x, sampleNrm.y, sampleNrm.z);
        ingestDetectedPlanes(frame, referenceSpace, ingestSample);
        if (refreshRoom()) {
          dirty = true;
        }
      }
    } else {
      objects.reticle.visible = false;
      internal.consecutiveHits = 0;
      if (internal.hitValid) {
        internal.hitValid = false;
        dirty = true;
      }
    }

    if (transientSource && canPlace()) {
      const touches = frame.getHitTestResultsForTransientInput(transientSource);
      const touch = touches[0];
      if (touch && touch.results.length > 0) {
        if (!placedThisTouch) {
          const touchPose = touch.results[0].getPose(referenceSpace);
          if (touchPose) {
            placedThisTouch = true;
            tapMatrix.fromArray(touchPose.transform.matrix);
            placeAtMatrix(tapMatrix);
          }
        }
      } else {
        placedThisTouch = false;
      }
    }

    if (dirty) {
      emit();
    }

    renderer.render(scene, camera);
  });

  const handle: ArRulerHandle = {
    undo: () => {
      if (internal.pending) {
        internal.pending = null;
        objects.pending.visible = false;
        emit();
        return;
      }
      const last = internal.lines.pop();
      if (last) {
        removeLineVisual(objects.lines, last.id);
        emit();
      }
    },
    deleteLine: (id: number) => {
      internal.lines = internal.lines.filter((line) => line.id !== id);
      removeLineVisual(objects.lines, id);
      if (internal.pending) {
        /* keep pending point */
      }
      emit();
    },
    end: async () => {
      if (!ended) {
        await session.end().catch(() => undefined);
      }
    },
  };

  return handle;
}

function ingestDetectedPlanes(
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
  ingest: (x: number, y: number, z: number, nx: number, ny: number, nz: number) => void,
): void {
  const planes = (frame as XRFrame & { detectedPlanes?: Iterable<{ planeSpace?: XRSpace; polygon?: Array<{ x: number; z: number }>; orientation?: string }> }).detectedPlanes;
  if (!planes) {
    return;
  }

  const matrix = new THREE.Matrix4();
  const origin = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const local = new THREE.Vector3();

  for (const plane of planes) {
    if (!plane.planeSpace || !plane.polygon?.length) {
      continue;
    }
    const pose = frame.getPose(plane.planeSpace, referenceSpace);
    if (!pose) {
      continue;
    }
    matrix.fromArray(pose.transform.matrix);
    origin.setFromMatrixPosition(matrix);
    normal.setFromMatrixColumn(matrix, 1).normalize();
    for (const vertex of plane.polygon) {
      local.set(vertex.x, 0, vertex.z).applyMatrix4(matrix);
      ingest(local.x, local.y, local.z, normal.x, normal.y, normal.z);
    }
  }
}

async function pickReferenceSpaceType(session: XRSession): Promise<XRReferenceSpaceType> {
  try {
    await session.requestReferenceSpace("local-floor");
    return "local-floor";
  } catch {
    return "local";
  }
}

function uiFromInternal(internal: InternalState): ArUiState {
  const room = internal.room;
  const base: ArUiState = {
    ...INITIAL_UI,
    phase: internal.phase,
    pending: Boolean(internal.pending),
    lines: internal.lines.map(({ id, label, meters }) => ({ id, label, meters })),
    hitValid: internal.hitValid,
    tracking: internal.tracking,
    roomLocked: internal.roomLocked,
    cornerCount: room ? (internal.roomLocked && room.hasCeiling ? 8 : 4) : 0,
    areaLabel: room && room.areaM2 >= 2 ? formatArea(room.areaM2) : null,
    heightLabel: room && room.hasCeiling ? formatDistance(room.heightM) : null,
  };

  if (!internal.tracking) {
    return {
      ...base,
      headline: "Tracking lost",
      instruction: "Move your phone slowly until surfaces lock again.",
      hitValid: false,
    };
  }

  if (internal.phase === "scanning") {
    return {
      ...base,
      headline: "Move your phone to scan",
      instruction: "Sweep floor, walls, and ceiling. Corners appear when the room is mapped.",
    };
  }

  if (internal.pending) {
    return {
      ...base,
      headline: "Tap the other end",
      instruction: "Drop the second point. Previous lines stay.",
    };
  }

  if (internal.roomLocked) {
    return {
      ...base,
      headline: "Room corners locked",
      instruction: "Keep adding tape lines, or delete one. Sweep more to refine.",
    };
  }

  return {
    ...base,
    headline: "Tap to measure",
    instruction: "Tap two points for a line. Look into corners so the 8 room points can lock.",
  };
}

function cleanupRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.setAnimationLoop(null);
  renderer.dispose();
  renderer.domElement.remove();
}
