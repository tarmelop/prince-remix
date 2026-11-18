"use strict";

// Builds assets/gfx/angela.png from the prince sprite sheet (assets/gfx/kid.png):
// long brown hair with lighter streaks, fairer skin, black top and dark trousers.
// Frame positions are unchanged, so assets/gfx/kid.json still describes it.
//
// Usage: node tools/make-angela.js

const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const root = path.join(__dirname, "..");
const image = PNG.sync.read(fs.readFileSync(path.join(root, "assets/gfx/kid.png")));
const atlas = JSON.parse(fs.readFileSync(path.join(root, "assets/gfx/kid.json"), "utf8"));

const key = (r, g, b) => r + "," + g + "," + b;

// Original palette groups
const HAIR = new Set([key(187, 153, 0), key(184, 144, 0), key(119, 85, 51), key(120, 92, 56)]);
const CLOTHES = new Set([key(255, 255, 221), key(252, 252, 216)]);
const CLOTHES_EDGE = new Set([key(221, 187, 170), key(216, 184, 160)]);
const SKIN = new Set([key(221, 136, 102), key(220, 128, 108)]);
const SKIN_SHADE = new Set([key(187, 119, 102), key(176, 112, 96)]);

// New look
const HAIR_BASE = [118, 82, 52];
const HAIR_DARK = [84, 56, 36];
const HAIR_STREAK = [176, 132, 88];
const SKIN_NEW = [236, 176, 146];
const SKIN_SHADE_NEW = [204, 142, 118];
const TOP = [34, 32, 40];
const TOP_EDGE = [78, 74, 92];
const PEARL = [236, 232, 220];
const PANTS = [124, 46, 66];
const PANTS_EDGE = [164, 76, 96];

const HAIR_LENGTH = 9; // pixels of hair hanging below the head
const TOP_RATIO = 0.42; // share of the clothed height that is the top

function frameTools(frame) {
  const f = frame.frame;
  const idx = (x, y) => ((f.y + y) * image.width + f.x + x) * 4;
  return {
    w: f.w,
    h: f.h,
    get(x, y) {
      if (x < 0 || y < 0 || x >= f.w || y >= f.h) {
        return null;
      }
      const i = idx(x, y);
      return { r: image.data[i], g: image.data[i + 1], b: image.data[i + 2], a: image.data[i + 3] };
    },
    colorKey(x, y) {
      const p = this.get(x, y);
      return p && p.a ? key(p.r, p.g, p.b) : null;
    },
    set(x, y, rgb) {
      const i = idx(x, y);
      image.data[i] = rgb[0];
      image.data[i + 1] = rgb[1];
      image.data[i + 2] = rgb[2];
      image.data[i + 3] = 255;
    }
  };
}

// Hair pixels of the head: the largest hair-colored blob, plus small blobs right next to it
// (a raised arm can split the hair in two). Stray same-colored pixels elsewhere are ignored.
function findHead(t) {
  const seen = new Set();
  const blobs = [];
  for (let sy = 0; sy < t.h; sy++) {
    for (let sx = 0; sx < t.w; sx++) {
      if (seen.has(sx + ":" + sy) || !HAIR.has(t.colorKey(sx, sy))) {
        continue;
      }
      const stack = [[sx, sy]];
      const pixels = [];
      while (stack.length) {
        const [x, y] = stack.pop();
        const k = x + ":" + y;
        if (seen.has(k) || !HAIR.has(t.colorKey(x, y))) {
          continue;
        }
        seen.add(k);
        pixels.push([x, y]);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            stack.push([x + dx, y + dy]);
          }
        }
      }
      blobs.push(pixels);
    }
  }
  if (!blobs.length) {
    return [];
  }
  blobs.sort((a, b) => b.length - a.length);
  const main = blobs[0];
  const near = (blob) => blob.some(([x, y]) => main.some(([mx, my]) => Math.abs(mx - x) <= 3 && Math.abs(my - y) <= 2));
  return main.concat(...blobs.slice(1).filter(near));
}

function processFrame(name, frame) {
  const t = frameTools(frame);
  const head = findHead(t);
  const headSet = new Set(head.map(([x, y]) => x + ":" + y));

  // Clothed area extent, to split top and trousers
  let clothTop = Infinity;
  let clothBottom = -1;
  for (let y = 0; y < t.h; y++) {
    for (let x = 0; x < t.w; x++) {
      if (CLOTHES.has(t.colorKey(x, y))) {
        clothTop = Math.min(clothTop, y);
        clothBottom = Math.max(clothBottom, y);
      }
    }
  }
  const waist = clothTop + Math.round((clothBottom - clothTop) * TOP_RATIO);

  // 1. Recolor
  for (let y = 0; y < t.h; y++) {
    for (let x = 0; x < t.w; x++) {
      const c = t.colorKey(x, y);
      if (!c) {
        continue;
      }
      if (headSet.has(x + ":" + y)) {
        const dark = c === key(119, 85, 51) || c === key(120, 92, 56);
        t.set(x, y, dark ? HAIR_DARK : (x + y) % 4 === 0 ? HAIR_STREAK : HAIR_BASE);
      } else if (CLOTHES.has(c)) {
        t.set(x, y, y <= waist ? TOP : PANTS);
      } else if (CLOTHES_EDGE.has(c)) {
        t.set(x, y, y <= waist ? TOP_EDGE : PANTS_EDGE);
      } else if (SKIN.has(c)) {
        t.set(x, y, SKIN_NEW);
      } else if (SKIN_SHADE.has(c)) {
        t.set(x, y, SKIN_SHADE_NEW);
      }
    }
  }

  if (!head.length) {
    return;
  }

  // 2. Long hair: hang it from the back of the head (sprites face left, so the back is the right side)
  const headBottom = Math.max(...head.map(([, y]) => y));
  const backEdge = Math.max(...head.map(([x]) => x));
  const headLeft = Math.min(...head.map(([x]) => x));
  const width = Math.max(3, Math.min(4, Math.round((backEdge - headLeft + 1) / 2)));
  for (let dy = 1; dy <= HAIR_LENGTH; dy++) {
    const y = headBottom + dy;
    if (y >= t.h) {
      break;
    }
    // Slightly narrower at the tips
    const w = dy > HAIR_LENGTH - 2 ? width - 1 : width;
    for (let i = 0; i < w; i++) {
      const x = backEdge - i;
      const c = t.colorKey(x, y);
      // Hair falls behind arms and face, over the back of the top
      if (c === null || CLOTHES.has(c) || CLOTHES_EDGE.has(c) || c === key(...TOP) || c === key(...TOP_EDGE)) {
        if (t.get(x, y) === null) {
          continue;
        }
        const streak = (x + dy) % 3 === 0;
        t.set(x, y, i === 0 ? HAIR_DARK : streak ? HAIR_STREAK : HAIR_BASE);
      }
    }
  }

  // 3. Fill the gap between the head's hair and the hanging hair on the back of the neck
  for (let y = 0; y <= headBottom; y++) {
    for (let x = backEdge - 1; x <= backEdge; x++) {
      if (t.colorKey(x, y) === null && head.some(([hx, hy]) => hy === y - 1 && Math.abs(hx - x) <= 1)) {
        t.set(x, y, HAIR_BASE);
      }
    }
  }

  // 4. Pearl collar dot at the neckline (she wears a studded collar)
  for (let y = headBottom + 1; y < Math.min(t.h, headBottom + 4); y++) {
    for (let x = headLeft; x < backEdge - width; x++) {
      if (t.colorKey(x, y) === key(...TOP)) {
        t.set(x, y, PEARL);
        return;
      }
    }
  }
}

for (const [name, frame] of Object.entries(atlas.frames)) {
  processFrame(name, frame);
}

const out = path.join(root, "assets/gfx/angela.png");
fs.writeFileSync(out, PNG.sync.write(image));
console.log("Wrote " + path.relative(root, out));
