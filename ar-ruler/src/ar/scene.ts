import * as THREE from "three";

const LASER = 0xe8ff47;
const MARKER_A = 0xe8ff47;
const MARKER_B = 0xffc14a;

export type MeasurementObjects = {
  reticle: THREE.Group;
  markerA: THREE.Group;
  markerB: THREE.Group;
  segment: THREE.Mesh;
  label: THREE.Sprite;
};

export function createScene(): {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  objects: MeasurementObjects;
} {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);

  const objects = {
    reticle: createReticle(),
    markerA: createMarker(MARKER_A),
    markerB: createMarker(MARKER_B),
    segment: createSegment(),
    label: createLabelSprite(),
  };

  objects.reticle.visible = false;
  objects.markerA.visible = false;
  objects.markerB.visible = false;
  objects.segment.visible = false;
  objects.label.visible = false;

  scene.add(objects.reticle, objects.markerA, objects.markerB, objects.segment, objects.label);

  return { scene, camera, objects };
}

function createReticle(): THREE.Group {
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.0032, 0.0044, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: LASER,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthTest: true,
    }),
  );

  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(0.0011, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: LASER, side: THREE.DoubleSide }),
  );
  inner.position.y = 0.001;

  group.add(ring, inner);
  return group;
}

function createMarker(color: number): THREE.Group {
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.007, 12, 10),
    new THREE.MeshBasicMaterial({ color }),
  );
  sphere.position.y = 0.008;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.009, 0.012, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    }),
  );

  group.add(ring, sphere);
  return group;
}

function createSegment(): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(0.0025, 0.0025, 1, 8);
  const material = new THREE.MeshBasicMaterial({ color: LASER });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  return mesh;
}

function createLabelSprite(): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      transparent: true,
      depthTest: false,
      sizeAttenuation: true,
    }),
  );
  sprite.scale.set(0.28, 0.07, 1);
  sprite.visible = false;
  return sprite;
}

export function placeFromMatrix(target: THREE.Group, matrix: THREE.Matrix4): THREE.Vector3 {
  target.matrix.copy(matrix);
  target.visible = true;
  return new THREE.Vector3().setFromMatrixPosition(target.matrix);
}

export function layoutSegment(segment: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  if (length < 0.0001) {
    segment.visible = false;
    return;
  }

  segment.visible = true;
  segment.scale.set(1, length, 1);
  segment.position.copy(a).add(b).multiplyScalar(0.5);
  segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
}

export function setLabel(sprite: THREE.Sprite, text: string, midpoint: THREE.Vector3): void {
  const texture = makeLabelTexture(text);
  const previous = sprite.material.map;
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;
  previous?.dispose();

  sprite.position.copy(midpoint);
  sprite.position.y += 0.05;
  sprite.visible = true;
}

function makeLabelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(9, 11, 8, 0.78)";
  roundRect(ctx, 16, 16, 480, 96, 18);
  ctx.fill();

  ctx.strokeStyle = "rgba(232, 255, 71, 0.55)";
  ctx.lineWidth = 3;
  roundRect(ctx, 16, 16, 480, 96, 18);
  ctx.stroke();

  ctx.fillStyle = "#e8ff47";
  ctx.font = "600 56px 'Spline Sans Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 68);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function resetMeasurement(objects: MeasurementObjects): void {
  objects.markerA.visible = false;
  objects.markerB.visible = false;
  objects.segment.visible = false;
  objects.label.visible = false;
}

export function disposeScene(scene: THREE.Scene, objects: MeasurementObjects): void {
  objects.label.material.map?.dispose();
  objects.label.material.dispose();
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material.dispose();
      }
    }
  });
}
