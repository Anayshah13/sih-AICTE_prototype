import * as THREE from "three";
import { formatDistance, worldDistanceMeters } from "./measure";
import {
  createScene,
  disposeScene,
  layoutSegment,
  placeFromMatrix,
  resetMeasurement,
  setLabel,
} from "./scene";
import type { ArUiState, MeasurePhase } from "./types";
import { INITIAL_UI } from "./types";
import { mapXrError } from "./webxr";

const READY_HIT_FRAMES = 8;

export type SessionCallbacks = {
  overlayRoot: HTMLElement;
  onUi: (state: ArUiState) => void;
  onEnded: () => void;
};

export type ArRulerHandle = {
  measureAgain: () => void;
  end: () => Promise<void>;
};

type InternalState = {
  phase: MeasurePhase;
  pointA: THREE.Vector3 | null;
  pointB: THREE.Vector3 | null;
  consecutiveHits: number;
  hitValid: boolean;
  tracking: boolean;
  distanceLabel: string | null;
  distanceMeters: number | null;
};

export async function startArSession(callbacks: SessionCallbacks): Promise<ArRulerHandle> {
  if (!navigator.xr) {
    throw new Error("WebXR is not available in this browser.");
  }

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
    optionalFeatures: ["local-floor"],
    domOverlay: { root: callbacks.overlayRoot },
  };

  // First await must be requestSession so Chrome still has the user gesture.
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
    pointA: null,
    pointB: null,
    consecutiveHits: 0,
    hitValid: false,
    tracking: true,
    distanceLabel: null,
    distanceMeters: null,
  };

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
    !ended &&
    internal.tracking &&
    internal.hitValid &&
    (internal.phase === "place-a" || internal.phase === "place-b");

  const finishIfComplete = (): void => {
    if (!internal.pointA || !internal.pointB) {
      return;
    }
    const meters = worldDistanceMeters(
      internal.pointA.x,
      internal.pointA.y,
      internal.pointA.z,
      internal.pointB.x,
      internal.pointB.y,
      internal.pointB.z,
    );
    layoutSegment(objects.segment, internal.pointA, internal.pointB);
    const midpoint = internal.pointA.clone().add(internal.pointB).multiplyScalar(0.5);
    const label = formatDistance(meters);
    setLabel(objects.label, label, midpoint);
    internal.phase = "measured";
    internal.distanceLabel = label;
    internal.distanceMeters = meters;
    objects.reticle.visible = false;
  };

  const placeAtMatrix = (matrix: THREE.Matrix4): void => {
    if (!canPlace()) {
      return;
    }
    if (internal.phase === "place-a") {
      internal.pointA = placeFromMatrix(objects.markerA, matrix);
      internal.phase = "place-b";
      emit();
      return;
    }
    internal.pointB = placeFromMatrix(objects.markerB, matrix);
    finishIfComplete();
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

    ndc.set(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );

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
      objects.reticle.visible = internal.phase !== "measured";
      objects.reticle.matrix.fromArray(hitPose.transform.matrix);
      internal.consecutiveHits += 1;
      if (!internal.hitValid) {
        internal.hitValid = true;
        dirty = true;
      }

      if (internal.phase === "scanning" && internal.consecutiveHits >= READY_HIT_FRAMES) {
        internal.phase = "place-a";
        dirty = true;
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
    measureAgain: () => {
      internal.pointA = null;
      internal.pointB = null;
      internal.consecutiveHits = 0;
      internal.hitValid = false;
      internal.distanceLabel = null;
      internal.distanceMeters = null;
      internal.phase = "scanning";
      resetMeasurement(objects);
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

async function pickReferenceSpaceType(session: XRSession): Promise<XRReferenceSpaceType> {
  try {
    await session.requestReferenceSpace("local-floor");
    return "local-floor";
  } catch {
    return "local";
  }
}

function uiFromInternal(internal: InternalState): ArUiState {
  const base: ArUiState = {
    ...INITIAL_UI,
    phase: internal.phase,
    hitValid: internal.hitValid,
    tracking: internal.tracking,
    distanceLabel: internal.distanceLabel,
    distanceMeters: internal.distanceMeters,
  };

  if (!internal.tracking && internal.phase !== "measured") {
    return {
      ...base,
      headline: "Tracking lost",
      instruction: "Move your phone slowly until surfaces lock again.",
      hitValid: false,
    };
  }

  switch (internal.phase) {
    case "scanning":
      return {
        ...base,
        headline: "Move your phone to scan",
        instruction: "Move your phone slowly to scan the room.",
      };
    case "place-a":
      return {
        ...base,
        headline: "Tap the first point",
        instruction: "Tap anywhere on the surface — you do not need the centre dot.",
      };
    case "place-b":
      return {
        ...base,
        headline: "Tap the second point",
        instruction: "Tap the other end anywhere on screen.",
      };
    case "measured":
      return {
        ...base,
        headline: "Distance",
        instruction: "",
      };
  }
}

function cleanupRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.setAnimationLoop(null);
  renderer.dispose();
  renderer.domElement.remove();
}
