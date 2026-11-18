"use strict";

// Builds the remixed title graphics from assets/gfx/title.png:
//   assets/gfx/title-logo.png      "CUGI of PERSIA" logo screen (same artwork, new word)
//   assets/gfx/title-presents.png  "Tarmelop Software presents"
//   assets/gfx/title-remix.png     "remixed by Carmelo Presicce"
// Letters are taken from the original title lettering; missing ones are drawn in the same style.
//
// Usage: node tools/make-titles.js

const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const root = path.join(__dirname, "..");
const sheet = PNG.sync.read(fs.readFileSync(path.join(root, "assets/gfx/title.png")));
const frames = JSON.parse(fs.readFileSync(path.join(root, "assets/gfx/title.json"), "utf8")).frames;

// --- image helpers ---

function cropFrame(name, x = 0, y = 0, w, h) {
  const f = frames[name].frame;
  w = w || f.w;
  h = h || f.h;
  const img = new PNG({ width: w, height: h });
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const s = ((f.y + y + yy) * sheet.width + f.x + x + xx) * 4;
      const d = (yy * w + xx) * 4;
      sheet.data.copy(img.data, d, s, s + 4);
    }
  }
  return img;
}

const get = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
};
const set = (img, x, y, c) => {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) {
    return;
  }
  const i = (y * img.width + x) * 4;
  img.data[i] = c[0];
  img.data[i + 1] = c[1];
  img.data[i + 2] = c[2];
  img.data[i + 3] = c[3] === undefined ? 255 : c[3];
};
const isWhite = (c) => c[0] > 230 && c[1] > 230 && c[2] > 230;
const save = (img, file) => {
  fs.writeFileSync(path.join(root, file), PNG.sync.write(img));
  console.log("Wrote " + file);
};

// ===================== Logo: CUGI of PERSIA =====================

const logo = cropFrame("prince");
const LOGO_TOP = 104;
const LOGO_BOTTOM = 172;

// Every white pixel of the logo lettering
const lettering = new Set();
for (let y = LOGO_TOP; y <= LOGO_BOTTOM; y++) {
  for (let x = 16; x < 306; x++) {
    if (isWhite(get(logo, x, y))) {
      lettering.add(x + ":" + y);
    }
  }
}
const isLetter = (x, y) => lettering.has(x + ":" + y);

// "of PERSIA" (including the swash of "of" that runs under the E)
function inOfPersia(x, y) {
  return x >= 150 || (y >= 144 && x >= 140) || (y >= 142 && x >= 146) || (y >= 134 && y <= 139 && x >= 146);
}

// Original pixels to reuse before the background gets repainted
const original = cropFrame("prince");
const ofPersia = [];
for (const k of lettering) {
  const [x, y] = k.split(":").map(Number);
  if (inOfPersia(x, y)) {
    ofPersia.push([x, y]);
  }
}

// Glyph masks lifted from the logo: [x, y] lists
function lift(x0, x1, y0, y1, keep = () => true) {
  const pts = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (isLetter(x, y) && keep(x, y)) {
        pts.push([x - x0, y - y0]);
      }
    }
  }
  return pts;
}

// C of PRINCE: x 116..133, y 108..144 (skipping the E it touches)
const C = lift(116, 135, 108, 144, (x, y) => {
  if (y <= 112) return x <= 133;
  if (y <= 116) return x <= 133 && !(x >= 134);
  if (y <= 116) return true;
  if (y <= 137) return x <= 132 && !(y >= 117 && x >= 132);
  if (y <= 141) return x <= 128 || (x <= 131 && y >= 139);
  return x <= 133;
}).filter(([x, y]) => !(y + 108 >= 113 && y + 108 <= 116 && x + 116 >= 134));

// I of PRINCE: top wedge and stem, x 80..87, y 108..149
const I_STEM = lift(80, 87, 108, 149, (x) => x >= 80);

function shift(points, dx, dy = 0) {
  return points.map(([x, y]) => [x + dx, y + dy]);
}
function rect(x0, y0, x1, y1) {
  const pts = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      pts.push([x, y]);
    }
  }
  return pts;
}
function rows(spec, x0, y0) {
  // spec: list of [startCol, endCol] per row
  const pts = [];
  spec.forEach(([a, b], i) => {
    for (let x = a; x <= b; x++) {
      pts.push([x0 + x, y0 + i]);
    }
  });
  return pts;
}
function union(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const [x, y] of list) {
      const k = x + ":" + y;
      if (!seen.has(k)) {
        seen.add(k);
        out.push([x, y]);
      }
    }
  }
  return out;
}

// I: stem plus a foot that sweeps left like the original
const I = union(I_STEM, rows([[2, 9], [0, 8], [0, 5], [0, 2]], 0, 42));

// U: two I stems joined by the bowl of the C
const cBowl = C.filter(([, y]) => y >= 26).map(([x, y]) => [x + 1, y]); // lower-left curve of C
const U = union(
  I_STEM.filter(([, y]) => y <= 26),
  shift(I_STEM.filter(([, y]) => y <= 34), 15),
  cBowl.filter(([x]) => x <= 19),
  rect(17, 27, 22, 35),
  rows([[13, 22], [12, 22], [14, 21], [17, 20]], 0, 33)
);

// G: the C with a bar and a short stem closing the lower right
const G = union(
  C.filter(([x, y]) => !(y >= 30 && y <= 33 && x >= 13)),
  rect(10, 19, 19, 21),
  rect(14, 19, 19, 34),
  rows([[13, 20], [12, 18]], 0, 34)
);

// Repaint the background behind all lettering
const TILE_LEFT = [16, 62];
const TILE_RIGHT = [258, 306];
function inTiles(x) {
  return (x >= TILE_LEFT[0] && x < TILE_LEFT[1]) || (x >= TILE_RIGHT[0] && x < TILE_RIGHT[1]);
}
function clean(x, y) {
  return !isLetter(x, y) && x >= 0 && x < 320;
}
const repainted = new Map();
for (const k of lettering) {
  const [x, y] = k.split(":").map(Number);
  let src = null;
  if (inTiles(x)) {
    // Tiles repeat every 8 rows and 18 columns
    outer: for (let n = 1; n < 12; n++) {
      for (const [dx, dy] of [
        [0, -8 * n],
        [0, 8 * n],
        [-18 * n, 0],
        [18 * n, 0],
        [-18 * n, -8 * n],
        [18 * n, 8 * n]
      ]) {
        const sx = x + dx;
        const sy = y + dy;
        if (inTiles(sx) && clean(sx, sy) && sy >= 90 && sy < 175) {
          src = [sx, sy];
          break outer;
        }
      }
    }
  }
  if (!src) {
    // Mirror the texture from the nearest clean pixels on the same row
    let l = x;
    let r = x;
    while (l > 0 && !clean(l, y)) l--;
    while (r < 319 && !clean(r, y)) r++;
    const useLeft = x - l <= r - x;
    const edge = useLeft ? l : r;
    let sx = useLeft ? edge - (x - edge) + 1 : edge + (edge - x) - 1;
    if (!clean(sx, y)) {
      sx = edge;
    }
    src = [sx, y];
  }
  repainted.set(k, get(original, src[0], src[1]));
}
for (const [k, c] of repainted) {
  const [x, y] = k.split(":").map(Number);
  set(logo, x, y, c);
}

// Lay out "CUGI of PERSIA" centered
const LOGO_WHITE = [243, 243, 243];
const GAP = 3;
const glyphs = [C, U, G, I];
const widths = glyphs.map((g) => Math.max(...g.map(([x]) => x)) + 1);
const ofLeft = 140;
const ofRight = 291;
const total = widths.reduce((a, b) => a + b, 0) + GAP * 3 + 5 + (ofRight - ofLeft + 1);
let cursor = Math.round((320 - total) / 2);
const TOP = 108;
glyphs.forEach((g, i) => {
  for (const [x, y] of g) {
    set(logo, cursor + x, TOP + y, LOGO_WHITE);
  }
  cursor += widths[i] + GAP;
});
const ofShift = cursor + 2 - ofLeft;
for (const [x, y] of ofPersia) {
  set(logo, x + ofShift, y, LOGO_WHITE);
}
save(logo, "assets/gfx/title-logo.png");

// ===================== Credit cards =====================

// Serif font from "a game by Jordan Mechner" / "presents": 3 ascender rows, 6 x-height rows, 3 descender rows
const SERIF = {
  a: [0, [".WWWW..", "....WW.", ".WWWWW.", "WW..WW.", "WW..WW.", ".WWW.WW"]],
  b: [3, ["WWW.....", ".WW.....", ".WW.....", ".WW.WWW.", ".WWW..WW", ".WW...WW", ".WW...WW", ".WW...W.", "WW.WWW.."]],
  c: [0, ["..WWWWW", ".WW..WW", "WW.....", "WW.....", ".WW..WW", "..WWWW."]],
  d: [3, ["....WWW.", ".....WW.", ".....WW.", "..WW.WW.", ".W..WWW.", "WW...WW.", "WW...WW.", "WW..WWW.", ".WWW.WWW"]],
  e: [0, ["..WWWW.", ".WW..WW", "WWWWWWW", "WW.....", ".WW..WW", "..WWWW."]],
  i: [3, ["....", ".WW.", "....", "WWW.", ".WW.", ".WW.", ".WW.", ".WW.", "WWWW"]],
  l: [3, ["WWW.", ".WW.", ".WW.", ".WW.", ".WW.", ".WW.", ".WW.", ".WW.", "WWWW"]],
  m: [0, ["WWW.WWW.WWWW..", ".WWW..WWW..WW.", ".WW...WW...WW.", ".WW...WW...WW.", ".WW...WW...WW.", "WWWW.WWWW..WWW"]],
  o: [0, ["..WWWW..", ".WW..WW.", "WW....WW", "WW....WW", ".WW..WW.", "..WWWW.."]],
  r: [0, ["WWW.WWW", ".WWW.WW", ".WW....", ".WW....", ".WW....", "WWWW..."]],
  s: [0, [".WWWW.", "WW..W.", ".WWW..", "...WW.", "WW..WW", ".WWWW."]],
  x: [0, ["WWW..WWW", ".WW..WW.", "..WWWW..", "..WWWW..", ".WW..WW.", "WWW..WWW"]],
  y: [0, ["WWWW.WWWW", ".WW...W..", "..WW.WW..", "..WW.W...", "...WWW...", "...WW....", "...W.....", "..WW.....", "WWW......"]],
  C: [3, ["..WWWWW.", ".WW...WW", "WW.....W", "WW......", "WW......", "WW......", "WW.....W", ".WW...WW", "..WWWWW."]],
  P: [3, ["WWWWWW..", ".WW..WW.", ".WW...WW", ".WW...WW", ".WW..WW.", ".WWWWW..", ".WW.....", ".WW.....", "WWWW...."]]
};

// Bold font from "Broderbund Software": 3 ascender rows, 8 x-height rows, 3 descender rows
const BOLD = {
  S: [3, ["..WWW.", ".WWWW.", "WWW...", "WWW...", ".WWW..", "..WWW.", "...WWW", "...WWW", "...WWW", "WWWWW.", "WWWW.."]],
  T: [3, ["WWWWWW", "WWWWWW", "..WW..", "..WW..", "..WW..", "..WW..", "..WW..", "..WW..", "..WW..", "..WW..", "..WW.."]],
  a: [0, [".WWWW.", ".WWWWW", "....WW", ".WWWWW", "WWWWWW", "WW..WW", "WWWWWW", ".WWWW."]],
  e: [0, [".WWWW.", "WWWWWW", "WW..WW", "WWWWWW", "WWWWW.", "WW....", "WWWWWW", ".WWWW."]],
  f: [3, ["..WWW", ".WWWW", ".WW..", "WWWWW", "WWWWW", ".WW..", ".WW..", ".WW..", ".WW..", ".WW..", ".WW.."]],
  l: [3, ["WW..", "WW..", "WW..", "WW..", "WW..", "WW..", "WW..", "WW..", "WW..", "WWWW", ".WWW"]],
  m: [0, [".WWWWWWWW.", "WWWWWWWWWW", "WW..WW..WW", "WW..WW..WW", "WW..WW..WW", "WW..WW..WW", "WW..WW..WW", "WW..WW..WW"]],
  o: [0, [".WWW..", "WWW..W", "WW..WW", "WW..WW", "WW..WW", "WW..WW", "W..WWW", "..WWW."]],
  p: [0, ["WWWWW.", "WWWWWW", "WW..WW", "WW..WW", "WW..WW", "WW..WW", "WWWWWW", "WWWWW.", "WW....", "WW....", "WW...."]],
  r: [0, [".WWW", "WWWW", "WW..", "WW..", "WW..", "WW..", "WW..", "WW.."]],
  t: [3, [".....", ".WW..", ".WW..", "WWWWW", "WWWWW", ".WW..", ".WW..", ".WW..", ".WW..", ".WWWW", "..WWW"]],
  w: [0, ["WW..WW..WW", "WW..WW..WW", "WW..WW..WW", "WW..WW..WW", "WW..WW..WW", "WW..WW..WW", "WWWWWWWWWW", ".WWW..WWW."]]
};

// Text as a set of white pixels; baseline is the bottom of the x-height
function layout(font, xHeight, text, space) {
  const pts = [];
  let x = 0;
  for (const ch of text) {
    if (ch === " ") {
      x += space;
      continue;
    }
    const [asc, glyph] = font[ch];
    const top = -xHeight - asc;
    glyph.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] === "W") {
          pts.push([x + c, top + r]);
        }
      }
    });
    const width = Math.max(...glyph.map((row) => row.replace(/\.+$/, "").length));
    x += width + 1;
  }
  return { pts, width: x - 1 };
}

// Draw outlined text centered at baseline y
function drawText(img, text, centerX, baseline) {
  const keys = new Set(text.pts.map(([x, y]) => x + ":" + y));
  const x0 = Math.round(centerX - text.width / 2);
  for (const [x, y] of text.pts) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!keys.has(x + dx + ":" + (y + dy))) {
          set(img, x0 + x + dx, baseline + y + dy, [0, 0, 0]);
        }
      }
    }
  }
  for (const [x, y] of text.pts) {
    set(img, x0 + x, baseline + y, [240, 240, 240]);
  }
}

// Presents card: same size and place as the original (128x47 at 96,106)
const presents = cropFrame("main_background", 96, 106, 128, 47);
const originalPresents = cropFrame("presents");
const backgroundPresents = cropFrame("main_background", 96, 106, 128, 47);
// keep the original "presents" word (rows 31..47)
for (let y = 31; y < 47; y++) {
  for (let x = 0; x < 128; x++) {
    const c = get(originalPresents, x, y);
    const b = get(backgroundPresents, x, y);
    if (c.join() !== b.join()) {
      set(presents, x, y, c);
    }
  }
}
drawText(presents, layout(BOLD, 8, "Tarmelop Software", 4), 64, 28);
save(presents, "assets/gfx/title-presents.png");

// Remix card: "remixed by" / "Carmelo Presicce", like "a game by" / "Jordan Mechner"
const REMIX_W = 140;
const remix = cropFrame("main_background", 160 - 3 - REMIX_W / 2, 122, REMIX_W, 30);
drawText(remix, layout(SERIF, 6, "remixed by", 4), REMIX_W / 2, 12);
drawText(remix, layout(SERIF, 6, "Carmelo Presicce", 4), REMIX_W / 2, 26);
save(remix, "assets/gfx/title-remix.png");
