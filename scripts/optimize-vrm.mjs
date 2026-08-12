#!/usr/bin/env node
/**
 * Shrinks a VRM (a GLB container) two ways:
 *
 *   1. Textures      - deduplicate identical images and downscale oversized ones.
 *   2. Morph targets - store blend shape deltas as glTF sparse accessors.
 *
 * A VRoid avatar carries dozens of blend shapes covering the whole body mesh,
 * but any single expression moves only a handful of vertices, so ~90% of the
 * stored deltas are exactly zero. Sparse accessors are core glTF 2.0 (and
 * supported by three.js), so this keeps the file a plain valid VRM.
 *
 *   node scripts/optimize-vrm.mjs in.vrm out.vrm [--max 1024] [--thumb 256] [--no-sparse]
 *
 * Why this rather than gltf-transform: VRM stores its own data in the
 * VRMC_vrm / VRM extensions, which reference textures, images and materials by
 * *array index*. General-purpose glTF optimizers reorder and reindex those
 * arrays, silently breaking expressions, spring bones and material settings.
 * This script only rewrites bufferView payloads and appends new bufferViews at
 * the end, so every existing index still points at what it did before.
 *
 * Requires ImageMagick (`magick`) on PATH.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function parseArgs(argv) {
  const [input, output] = argv.filter((a) => !a.startsWith("--"));
  if (!input || !output) {
    console.error("usage: optimize-vrm.mjs <in.vrm> <out.vrm> [--max N] [--thumb N]");
    process.exit(1);
  }
  const flag = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? fallback : Number(argv[i + 1]);
  };
  const str = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : argv[i + 1];
  };
  return {
    input,
    output,
    max: flag("max", 1024),
    thumb: flag("thumb", 256),
    sparse: !argv.includes("--no-sparse"),
    trimMaterial: str("trim-material"),
    trimAbove: str("trim-above") == null ? null : flag("trim-above", null),
  };
}

const COMPONENT_SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const COMPONENT_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB file");

  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === JSON_CHUNK) json = JSON.parse(chunk.toString("utf8"));
    else if (type === BIN_CHUNK) bin = chunk;
    offset += 8 + length + ((4 - (length % 4)) % 4);
  }
  if (!json || !bin) throw new Error("GLB is missing a JSON or BIN chunk");
  return { json, bin };
}

function writeGlb(json, bin) {
  const pad = (buf, fill) => {
    const rem = buf.length % 4;
    return rem === 0 ? buf : Buffer.concat([buf, Buffer.alloc(4 - rem, fill)]);
  };
  const jsonChunk = pad(Buffer.from(JSON.stringify(json), "utf8"), 0x20);
  const binChunk = pad(bin, 0x00);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);

  const chunkHeader = (length, type) => {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(length, 0);
    b.writeUInt32LE(type, 4);
    return b;
  };

  return Buffer.concat([
    header,
    chunkHeader(jsonChunk.length, JSON_CHUNK),
    jsonChunk,
    chunkHeader(binChunk.length, BIN_CHUNK),
    binChunk,
  ]);
}

/** Downscale with ImageMagick, keeping the format. Returns the original on any failure. */
function resize(data, maxSize, workDir, tag) {
  const src = join(workDir, `${tag}.png`);
  const dst = join(workDir, `${tag}.out.png`);
  writeFileSync(src, data);
  try {
    execFileSync("magick", [
      src,
      "-resize", `${maxSize}x${maxSize}>`, // ">" = only shrink, never enlarge
      "-strip",
      "-define", "png:compression-level=9",
      dst,
    ]);
    const out = readFileSync(dst);
    return out.length < data.length ? out : data;
  } catch (error) {
    console.warn(`  ! resize failed for ${tag}, keeping original: ${error.message}`);
    return data;
  }
}

/**
 * Rewrites float morph-target accessors as sparse accessors, dropping the
 * all-zero deltas. Returns the number of accessors converted.
 *
 * New payloads are appended to `extraViews`; callers splice those onto the end
 * of json.bufferViews so no existing bufferView index changes.
 */
function sparsifyMorphTargets(json, bin, extraViews) {
  const accessors = json.accessors ?? [];
  const bufferViews = json.bufferViews ?? [];

  // Only touch accessors used *exclusively* as morph target deltas.
  const morphAccessors = new Set();
  const otherAccessors = new Set();
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      for (const index of Object.values(primitive.attributes ?? {})) otherAccessors.add(index);
      if (primitive.indices != null) otherAccessors.add(primitive.indices);
      for (const target of primitive.targets ?? []) {
        for (const index of Object.values(target)) morphAccessors.add(index);
      }
    }
  }
  for (const skin of json.skins ?? []) {
    if (skin.inverseBindMatrices != null) otherAccessors.add(skin.inverseBindMatrices);
  }
  for (const animation of json.animations ?? []) {
    for (const sampler of animation.samplers ?? []) {
      otherAccessors.add(sampler.input);
      otherAccessors.add(sampler.output);
    }
  }

  let converted = 0;

  for (const index of morphAccessors) {
    if (otherAccessors.has(index)) continue;

    const accessor = accessors[index];
    if (!accessor || accessor.sparse || accessor.bufferView == null) continue;
    if (accessor.componentType !== 5126) continue; // floats only

    const view = bufferViews[accessor.bufferView];
    const comps = COMPONENT_COUNT[accessor.type];
    if (!view || !comps) continue;

    const elementSize = comps * 4;
    const stride = view.byteStride || elementSize;
    const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

    // Collect the elements that actually move.
    const indices = [];
    const values = [];
    for (let e = 0; e < accessor.count; e++) {
      const at = base + e * stride;
      let nonZero = false;
      const element = new Array(comps);
      for (let c = 0; c < comps; c++) {
        const v = bin.readFloatLE(at + c * 4);
        element[c] = v;
        if (v !== 0) nonZero = true;
      }
      if (nonZero) {
        indices.push(e);
        values.push(element);
      }
    }

    // glTF requires sparse.count >= 1, so an entirely-zero target keeps one
    // zero entry rather than being dropped.
    if (indices.length === 0) {
      indices.push(0);
      values.push(new Array(comps).fill(0));
    }

    const indexComponentType = accessor.count <= 65536 ? 5123 : 5125;
    const indexSize = COMPONENT_SIZE[indexComponentType];
    const sparseBytes = indices.length * (indexSize + elementSize);
    if (sparseBytes >= accessor.count * elementSize) continue; // no win

    const indexBuffer = Buffer.alloc(indices.length * indexSize);
    indices.forEach((value, i) => {
      if (indexComponentType === 5123) indexBuffer.writeUInt16LE(value, i * 2);
      else indexBuffer.writeUInt32LE(value, i * 4);
    });

    const valueBuffer = Buffer.alloc(values.length * elementSize);
    values.forEach((element, i) => {
      element.forEach((v, c) => valueBuffer.writeFloatLE(v, i * elementSize + c * 4));
    });

    // `buffer` is required on every bufferView; without it a loader resolves
    // json.buffers[undefined] and dies.
    const indexView = bufferViews.length + extraViews.length;
    extraViews.push({ payload: indexBuffer, def: { buffer: 0 } });
    const valueView = bufferViews.length + extraViews.length;
    extraViews.push({ payload: valueBuffer, def: { buffer: 0 } });

    delete accessor.bufferView;
    delete accessor.byteOffset;
    accessor.sparse = {
      count: indices.length,
      indices: { bufferView: indexView, byteOffset: 0, componentType: indexComponentType },
      values: { bufferView: valueView, byteOffset: 0 },
    };
    converted++;
  }

  return converted;
}

/**
 * Drops triangles that reach above `maxY` from primitives whose material name
 * contains `materialMatch`.
 *
 * VRoid ribbon and hair cards taper to a point. Past a certain height those
 * triangles are narrower than a pixel, so the rasterizer can only render them
 * as a scatter of disconnected dark dots hanging in the air above the head —
 * they never read as part of the model. Removing them costs nothing visible
 * and removes the specks. Only the index buffer changes, so vertices, skin
 * weights and morph targets are all untouched.
 */
function trimTaperedTips(json, bin, extraViews, materialMatch, maxY) {
  const accessors = json.accessors ?? [];
  const bufferViews = json.bufferViews ?? [];
  let dropped = 0;
  let affected = 0;

  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const material = json.materials?.[primitive.material];
      if (!material?.name?.includes(materialMatch)) continue;
      if (primitive.indices == null || primitive.attributes?.POSITION == null) continue;

      const indexAccessor = accessors[primitive.indices];
      const posAccessor = accessors[primitive.attributes.POSITION];
      const indexView = bufferViews[indexAccessor.bufferView];
      const posView = bufferViews[posAccessor.bufferView];
      if (!indexView || !posView) continue;

      const indexSize = COMPONENT_SIZE[indexAccessor.componentType];
      const indexBase = (indexView.byteOffset ?? 0) + (indexAccessor.byteOffset ?? 0);
      const readIndex = (i) => {
        const at = indexBase + i * indexSize;
        if (indexSize === 1) return bin.readUInt8(at);
        if (indexSize === 2) return bin.readUInt16LE(at);
        return bin.readUInt32LE(at);
      };

      const posStride = posView.byteStride || 12;
      const posBase = (posView.byteOffset ?? 0) + (posAccessor.byteOffset ?? 0);
      const readY = (v) => bin.readFloatLE(posBase + v * posStride + 4);

      const kept = [];
      for (let t = 0; t < indexAccessor.count / 3; t++) {
        const tri = [readIndex(t * 3), readIndex(t * 3 + 1), readIndex(t * 3 + 2)];
        if (Math.max(...tri.map(readY)) > maxY) {
          dropped++;
          continue;
        }
        kept.push(...tri);
      }
      if (dropped === 0) continue;

      const buffer = Buffer.alloc(kept.length * indexSize);
      kept.forEach((value, i) => {
        if (indexSize === 1) buffer.writeUInt8(value, i);
        else if (indexSize === 2) buffer.writeUInt16LE(value, i * 2);
        else buffer.writeUInt32LE(value, i * 4);
      });

      const view = bufferViews.length + extraViews.length;
      extraViews.push({ payload: buffer, def: { buffer: 0, target: 34963 } });
      indexAccessor.bufferView = view;
      indexAccessor.byteOffset = 0;
      indexAccessor.count = kept.length;
      affected++;
    }
  }

  return { dropped, affected };
}

/** Total bytes of the unique bufferViews backing morph-target accessors. */
function morphViewBytes(json) {
  const views = new Set();
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      for (const target of primitive.targets ?? []) {
        for (const index of Object.values(target)) {
          const accessor = json.accessors[index];
          if (accessor.bufferView != null) views.add(accessor.bufferView);
          if (accessor.sparse) {
            views.add(accessor.sparse.indices.bufferView);
            views.add(accessor.sparse.values.bufferView);
          }
        }
      }
    }
  }
  let total = 0;
  for (const index of views) total += json.bufferViews[index]?.byteLength ?? 0;
  return total;
}

const { input, output, max, thumb, sparse, trimMaterial, trimAbove } =
  parseArgs(process.argv.slice(2));
const original = readFileSync(input);
const { json, bin } = readGlb(original);

const images = json.images ?? [];
const bufferViews = json.bufferViews ?? [];

// VRM 0.x puts the thumbnail index at extensions.VRM.meta.texture (a *texture*
// index); VRM 1.0 puts it at extensions.VRMC_vrm.meta.thumbnailImage (an
// *image* index). Only the thumbnail gets shrunk aggressively: it is metadata
// for model browsers and is never rendered in-scene.
let thumbnailImage = json.extensions?.VRMC_vrm?.meta?.thumbnailImage;
const vrm0Texture = json.extensions?.VRM?.meta?.texture;
if (thumbnailImage == null && vrm0Texture != null && vrm0Texture >= 0) {
  thumbnailImage = json.textures?.[vrm0Texture]?.source;
}

const workDir = mkdtempSync(join(tmpdir(), "vrmopt-"));
const imageBytesBefore = images.reduce(
  (sum, image) => sum + (bufferViews[image.bufferView]?.byteLength ?? 0),
  0
);

try {
  // Rewrite each image payload, remembering the result per source hash so
  // identical textures collapse onto one shared bufferView.
  const byHash = new Map();
  const newPayloads = new Map(); // bufferView index -> Buffer

  images.forEach((image, i) => {
    const viewIndex = image.bufferView;
    const view = bufferViews[viewIndex];
    if (view == null) return;

    const start = view.byteOffset ?? 0;
    const data = bin.subarray(start, start + view.byteLength);
    const isThumb = i === thumbnailImage;
    const hash = createHash("sha1").update(data).digest("hex") + (isThumb ? ":t" : "");

    const seen = byHash.get(hash);
    if (seen !== undefined) {
      // Point this image at the identical image's bufferView. Index-safe:
      // images[i] keeps its slot, it just shares storage.
      image.bufferView = seen;
      return;
    }

    const resized = resize(data, isThumb ? thumb : max, workDir, `img${i}`);
    newPayloads.set(viewIndex, resized);
    byHash.set(hash, viewIndex);
  });

  const morphBytesBefore = morphViewBytes(json);
  const extraViews = [];
  const trimmed =
    trimMaterial && trimAbove != null
      ? trimTaperedTips(json, bin, extraViews, trimMaterial, trimAbove)
      : { dropped: 0, affected: 0 };
  const sparsified = sparse ? sparsifyMorphTargets(json, bin, extraViews) : 0;

  // Anything still pointed at by an image or an accessor has to keep its bytes.
  // Everything else is dead weight left over from dedup or sparsification.
  const referenced = new Set(images.map((image) => image.bufferView));
  for (const accessor of json.accessors ?? []) {
    if (accessor.bufferView != null) referenced.add(accessor.bufferView);
    if (accessor.sparse) {
      referenced.add(accessor.sparse.indices.bufferView);
      referenced.add(accessor.sparse.values.bufferView);
    }
  }

  // Rebuild the binary chunk. Every existing bufferView keeps its index and its
  // non-offset properties; only byteOffset/byteLength move. New views are
  // appended after them.
  const chunks = [];
  let cursor = 0;
  const place = (view, payload) => {
    const padding = (4 - (cursor % 4)) % 4;
    if (padding) {
      chunks.push(Buffer.alloc(padding));
      cursor += padding;
    }
    view.byteOffset = cursor;
    view.byteLength = payload.length;
    chunks.push(payload);
    cursor += payload.length;
  };

  const originalViewCount = bufferViews.length;
  for (let i = 0; i < originalViewCount; i++) {
    const view = bufferViews[i];
    if (!referenced.has(i)) {
      // Dropping it would shift every later index, so it shrinks to a stub.
      // 1 byte rather than 0: the spec requires byteLength >= 1.
      delete view.byteStride;
      place(view, Buffer.alloc(1));
      continue;
    }
    const payload = newPayloads.has(i)
      ? newPayloads.get(i)
      : bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    place(view, payload);
  }
  for (const { payload, def } of extraViews) {
    bufferViews.push(def);
    place(def, payload);
  }

  const newBin = Buffer.concat(chunks);
  if (json.buffers?.[0]) json.buffers[0].byteLength = newBin.length;

  const result = writeGlb(json, newBin);
  writeFileSync(output, result);

  const imageBytesAfter = images.reduce((sum, image) => {
    const view = bufferViews[image.bufferView];
    return sum + (view?.byteLength ?? 0);
  }, 0);
  const mb = (n) => (n / 1048576).toFixed(2) + " MB";
  const dedup = images.length - new Set(images.map((i) => i.bufferView)).size;

  console.log(`textures : ${mb(imageBytesBefore)} -> ${mb(imageBytesAfter)}`);
  console.log(`deduped  : ${dedup} image(s) now share storage`);
  console.log(`morphs   : ${mb(morphBytesBefore)} -> ${mb(morphViewBytes(json))}` +
    `  (${sparsified} accessor(s) made sparse)`);
  if (trimmed.affected) {
    console.log(`trimmed  : ${trimmed.dropped} sub-pixel triangle(s) from ` +
      `${trimmed.affected} primitive(s) matching "${trimMaterial}" above y=${trimAbove}`);
  }
  console.log(`file     : ${mb(original.length)} -> ${mb(result.length)}` +
    `  (${(100 * (1 - result.length / original.length)).toFixed(0)}% smaller)`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
