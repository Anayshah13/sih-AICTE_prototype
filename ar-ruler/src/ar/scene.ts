import * as THREE from "three";
import type { Vec3 } from "./room";

const TAPE = 0xf4f4f0;
const FLOOR_CORNER = 0x7af0ff;
const CEIL_CORNER = 0xffc14a;
const ROOM_EDGE = 0x9dff6a;

export type LineVisual = {
  id: number;
  group: THREE.Group;
  label: THREE.Sprite;
};

export type MeasurementObjects = {
  reticle: THREE.Group;
  pending: THREE.Group;
  lines: THREE.Group;
  room: THREE.Group;
};

export function createScene(): {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  objects: MeasurementObjects;
} {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);

  const objects: MeasurementObjects = {
    reticle: createReticle(),
    pending: createEndpoint(0.0048),
    lines: new THREE.Group(),
    room: new THREE.Group(),
  };

  objects.reticle.visible = false;
  objects.pending.visible = false;
  objects.room.visible = false;

  scene.add(objects.reticle, objects.pending, objects.lines, objects.room);

  return { scene, camera, objects };
}

function createReticle(): THREE.Group {
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.003, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: TAPE, side: THREE.DoubleSide }),
  );
  disc.position.y = 0.001;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.006, 0.0072, 36).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: TAPE,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    }),
  );

  group.add(disc, ring);
  return group;
}

function createEndpoint(radius = 0.0046): THREE.Group {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: TAPE,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  disc.position.y = 0.0015;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 1.15, radius * 1.45, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: TAPE,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
      depthTest: false,
    }),
  );
  ring.position.y = 0.0016;
  group.add(disc, ring);
  return group;
}

function createMarker(color: number, radius = 0.008): THREE.Group {
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 1.35, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    }),
  );

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 1.55, radius * 2.15, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    }),
  );

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, radius * 2.4, 8),
    new THREE.MeshBasicMaterial({ color }),
  );
  stem.position.y = radius * 1.2;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.42, 12, 10),
    new THREE.MeshBasicMaterial({ color }),
  );
  head.position.y = radius * 2.5;

  group.add(disc, ring, stem, head);
  return group;
}

function createSegment(color: number, radius = 0.0032, opacity = 1): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1, 10),
    new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    }),
  );
}

function createTapeMeshes(): { core: THREE.Mesh; glow: THREE.Mesh } {
  return {
    core: createSegment(TAPE, 0.00115),
    glow: createSegment(TAPE, 0.0024, 0.18),
  };
}

function createLabelSprite(scaleX = 0.34, scaleY = 0.085): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      transparent: true,
      depthTest: false,
      sizeAttenuation: true,
    }),
  );
  sprite.scale.set(scaleX, scaleY, 1);
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
  sprite.position.y += 0.028;
  sprite.visible = true;
}

function makeLabelTexture(text: string, color = "#111111"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  roundRect(ctx, 36, 18, 440, 60, 30);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.font = "600 36px 'Spline Sans Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 50);

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

export function createLineVisual(
  id: number,
  a: THREE.Vector3,
  b: THREE.Vector3,
  labelText: string,
): LineVisual {
  const group = new THREE.Group();
  const markerA = createEndpoint(0.0046);
  const markerB = createEndpoint(0.0046);
  const { core, glow } = createTapeMeshes();
  const label = createLabelSprite(0.22, 0.042);

  markerA.position.copy(a);
  markerB.position.copy(b);
  layoutSegment(glow, a, b);
  layoutSegment(core, a, b);
  setLabel(label, labelText, a.clone().add(b).multiplyScalar(0.5));

  group.add(glow, core, markerA, markerB, label);
  group.userData.id = id;
  return { id, group, label };
}

export function removeLineVisual(lines: THREE.Group, id: number): void {
  const child = lines.children.find((item) => item.userData.id === id);
  if (!child) {
    return;
  }
  disposeObject(child);
  lines.remove(child);
}

export function clearGroup(group: THREE.Group): void {
  while (group.children.length) {
    const child = group.children[0];
    disposeObject(child);
    group.remove(child);
  }
}

function numberedCorner(label: string, color: number): THREE.Group {
  const group = new THREE.Group();
  const pin = createMarker(color, 0.016);
  pin.matrixAutoUpdate = true;
  const sprite = createLabelSprite(0.24, 0.07);
  const texture = makeLabelTexture(label, color === FLOOR_CORNER ? "#7af0ff" : "#ffc14a");
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;
  sprite.position.y = 0.08;
  sprite.visible = true;
  group.add(pin, sprite);
  return group;
}

const BOX_EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

export function updateRoomVisual(
  room: THREE.Group,
  corners: Vec3[],
  areaLabel: string,
  hasCeiling: boolean,
): void {
  clearGroup(room);
  if (corners.length < 4) {
    room.visible = false;
    return;
  }

  const pts = corners.map((c) => new THREE.Vector3(c.x, c.y, c.z));
  const floorCount = 4;
  for (let i = 0; i < floorCount; i += 1) {
    const marker = numberedCorner(`F${i + 1}`, FLOOR_CORNER);
    marker.position.copy(pts[i]);
    room.add(marker);
  }

  if (hasCeiling && pts.length >= 8) {
    for (let i = 4; i < 8; i += 1) {
      const marker = numberedCorner(`C${i - 3}`, CEIL_CORNER);
      marker.position.copy(pts[i]);
      room.add(marker);
    }
  }

  const edgeCount = hasCeiling && pts.length >= 8 ? BOX_EDGES.length : 4;
  for (let i = 0; i < edgeCount; i += 1) {
    const [ia, ib] = BOX_EDGES[i];
    if (!pts[ia] || !pts[ib]) {
      continue;
    }
    const edge = createSegment(ROOM_EDGE, 0.004);
    layoutSegment(edge, pts[ia], pts[ib]);
    room.add(edge);
  }

  const floorShape = new THREE.Shape();
  floorShape.moveTo(pts[0].x, pts[0].z);
  for (let i = 1; i < 4; i += 1) {
    floorShape.lineTo(pts[i].x, pts[i].z);
  }
  floorShape.closePath();
  const fill = new THREE.Mesh(
    new THREE.ShapeGeometry(floorShape),
    new THREE.MeshBasicMaterial({
      color: FLOOR_CORNER,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  fill.rotation.x = Math.PI / 2;
  fill.position.y = pts[0].y + 0.005;
  room.add(fill);

  const areaSprite = createLabelSprite(0.48, 0.12);
  const mid = pts[0].clone().add(pts[2]).multiplyScalar(0.5);
  setLabel(areaSprite, areaLabel, mid);
  room.add(areaSprite);
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((item) => {
          if ("map" in item && item.map) {
            item.map.dispose();
          }
          item.dispose();
        });
      } else {
        if ("map" in material && material.map) {
          material.map.dispose();
        }
        material.dispose();
      }
    }
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
    }
  });
}

export function resetMeasurement(objects: MeasurementObjects): void {
  objects.pending.visible = false;
  clearGroup(objects.lines);
}

export function disposeScene(scene: THREE.Scene, objects: MeasurementObjects): void {
  clearGroup(objects.lines);
  clearGroup(objects.room);
  disposeObject(objects.reticle);
  disposeObject(objects.pending);
  scene.clear();
}
