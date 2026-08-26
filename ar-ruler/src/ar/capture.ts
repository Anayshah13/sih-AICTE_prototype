import type { WebGLRenderer } from "three";

function haptic(ms = 12): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

export function placeHaptic(): void {
  haptic(12);
}

export function shotHaptic(): void {
  haptic(20);
}

export async function captureXrPng(renderer: WebGLRenderer): Promise<Blob> {
  const gl = renderer.getContext();
  const session = renderer.xr.getSession();
  const layer = session?.renderState.baseLayer ?? null;

  let width = gl.drawingBufferWidth;
  let height = gl.drawingBufferHeight;
  if (layer) {
    width = layer.framebufferWidth;
    height = layer.framebufferHeight;
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
  }

  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not capture screenshot.");
  }

  const imageData = ctx.createImageData(width, height);
  const row = width * 4;
  for (let y = 0; y < height; y += 1) {
    const src = (height - 1 - y) * row;
    imageData.data.set(pixels.subarray(src, src + row), y * row);
  }
  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob || blob.size < 64) {
    const fallback = await canvasFromElement(renderer.domElement);
    if (fallback) {
      return fallback;
    }
    throw new Error("Could not encode screenshot.");
  }
  return blob;
}

async function canvasFromElement(el: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    el.toBlob((blob) => resolve(blob), "image/png");
  });
}

export async function shareOrDownloadPng(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });
  const payload = { files: [file], title: "AR Ruler" };
  try {
    if (navigator.canShare?.(payload)) {
      await navigator.share(payload);
      return;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
