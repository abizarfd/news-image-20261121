// THE WORLD IN ONE DAY — Saturday 21 November 2026
// A one-day newspaper front page, drawn entirely in code.
// Node 22+ stdlib only, no network. Writes one deterministic PNG to
// $MAKEFUN_OUTPUT_DIR/entry.png (or /output/entry.png).
// 1024x1024, at most 1 MiB, byte-identical across runs.

import * as fs from "node:fs";
import * as zlib from "node:zlib";

// ---------------------------------------------------------------- PNG ----
// Minimal PNG encoder: 8-bit RGB, no interlace, filter 0 per scanline.

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 0);
  crc.copy(out, 8 + data.length);
  return out;
}

function encodePNG(width: number, height: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- font ----
// Hand-drawn 5x7 pixel font. Each glyph is 7 rows of 5 bits.
// Covers A-Z, 0-9 and the punctuation this page needs.

type Glyph = string[];
const FONT: Record<string, Glyph> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "•": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
};

const CHAR_W = 5;
const CHAR_H = 7;

type RGB = [number, number, number];

// ----------------------------------------------------------- canvas ----
class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Buffer; // RGB, row-major

  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 3);
    this.fillRect(0, 0, w, h, bg);
  }

  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 3;
    this.px[o] = c[0];
    this.px[o + 1] = c[1];
    this.px[o + 2] = c[2];
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const o = (yy * this.w + xx) * 3;
        this.px[o] = c[0];
        this.px[o + 1] = c[1];
        this.px[o + 2] = c[2];
      }
    }
  }

  border(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
    this.fillRect(x, y, w, t, c);
    this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c);
    this.fillRect(x + w - t, y, t, h, c);
  }

  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      for (let xx = cx - dx; xx <= cx + dx; xx++) this.set(xx, cy + dy, c);
    }
  }

  // Filled ellipse centred at (cx, cy) with radii rx, ry.
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    for (let dy = -ry; dy <= ry; dy++) {
      const t = 1 - (dy * dy) / (ry * ry);
      if (t < 0) continue;
      const dx = Math.floor(rx * Math.sqrt(t));
      for (let xx = cx - dx; xx <= cx + dx; xx++) this.set(xx, cy + dy, c);
    }
  }

  // Bresenham line with round caps of radius floor(t/2).
  line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    const r = Math.max(0, Math.floor(t / 2));
    for (;;) {
      if (r === 0) this.set(x, y, c);
      else this.disc(x, y, r, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  // Four-point star burst (explosion) centred at (cx, cy).
  burst(cx: number, cy: number, r: number, c: RGB): void {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const len = i % 2 === 0 ? r : Math.floor(r * 0.45);
      this.line(
        cx,
        cy,
        Math.round(cx + Math.cos(a) * len),
        Math.round(cy + Math.sin(a) * len),
        3,
        c,
      );
    }
    this.disc(cx, cy, Math.max(2, Math.floor(r * 0.28)), c);
  }
}

// ------------------------------------------------------------- text ----
function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * (CHAR_W * scale + scale) - scale;
}

function drawText(cv: Canvas, x: number, y: number, s: string, scale: number, c: RGB): void {
  // The font holds capitals only; fold everything to upper case so that
  // mixed-case copy still renders every letter.
  const up = s.toUpperCase();
  let cx = x;
  for (const ch of up) {
    const g = FONT[ch];
    if (g) {
      for (let row = 0; row < CHAR_H; row++) {
        for (let col = 0; col < CHAR_W; col++) {
          if (g[row][col] === "1") {
            cv.fillRect(cx + col * scale, y + row * scale, scale, scale, c);
          }
        }
      }
    }
    cx += CHAR_W * scale + scale;
  }
}

function drawTextCentered(cv: Canvas, cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cv, cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

// Greedy word wrap to a pixel width; returns lines (never splits a word).
function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ----------------------------------------------------------- palette ----
const PAPER: RGB = [246, 241, 229];
const PANEL: RGB = [255, 253, 246];
const INK: RGB = [22, 35, 63];
const NAVY: RGB = [22, 35, 63];
const GOLD: RGB = [201, 162, 39];
const GOLD_LT: RGB = [244, 211, 94];
const WHITE: RGB = [255, 255, 255];
const GREY: RGB = [90, 96, 110];
const RED: RGB = [185, 28, 28];
const ORANGE: RGB = [194, 65, 12];
const BLUE: RGB = [29, 78, 216];
const GREEN: RGB = [21, 128, 61];
const SKY: RGB = [186, 214, 235];
const SKY_DK: RGB = [120, 165, 205];

// ----------------------------------------------------------- stories ----
// Researched from the 21 November 2026 news cycle (Reuters, WSJ, AP,
// One Turn, The Hindu BusinessLine, JagranJosh). Six main stories plus
// a three-line ticker of secondary items. All events happened or were
// first reported on 21 November 2026 (any time zone), or dominated that
// day's reporting after breaking late on 20 November.

interface Story {
  kicker: string;
  kickerColor: RGB;
  headline: string;
  summary: string;
  accent: RGB;
  band: RGB; // icon band background
  icon: (cv: Canvas, x: number, y: number, w: number, h: number) => void;
}

function iconPoland(cv: Canvas, x: number, y: number, w: number, h: number): void {
  // Night sky, a missile streaking in, explosion burst, compass star.
  cv.fillRect(x, y, w, h, [24, 30, 54]);
  cv.disc(x + 40, y + 12, 2, WHITE);
  cv.disc(x + 120, y + 8, 2, WHITE);
  cv.disc(x + 300, y + 14, 2, WHITE);
  cv.disc(x + 410, y + 10, 2, WHITE);
  // Missile body, nose to the upper right.
  cv.line(x + 150, y + 44, x + 300, y + 14, 10, [226, 232, 240]);
  cv.line(x + 300, y + 14, x + 322, y + 10, 10, RED);
  cv.line(x + 150, y + 44, x + 132, y + 50, 6, [148, 163, 184]);
  cv.line(x + 150, y + 44, x + 138, y + 30, 6, [148, 163, 184]);
  // Flame trail.
  cv.line(x + 150, y + 44, x + 108, y + 52, 5, GOLD_LT);
  cv.line(x + 108, y + 52, x + 84, y + 54, 3, ORANGE);
  // Explosion where it came down.
  cv.burst(x + 372, y + 40, 18, GOLD_LT);
  cv.burst(x + 372, y + 40, 10, ORANGE);
  // Compass star (NATO) at right.
  cv.disc(x + 428, y + 38, 11, BLUE);
  cv.line(x + 428, y + 24, x + 428, y + 52, 3, WHITE);
  cv.line(x + 414, y + 38, x + 442, y + 38, 3, WHITE);
}

function iconKyiv(cv: Canvas, x: number, y: number, w: number, h: number): void {
  // City skyline at dusk, two blasts, smoke.
  cv.fillRect(x, y, w, h, [52, 38, 44]);
  const base = y + h;
  const towers: Array<[number, number, number]> = [
    [0, 34, 26],
    [30, 44, 22],
    [56, 30, 24],
    [84, 48, 20],
    [108, 36, 26],
    [138, 52, 22],
    [164, 32, 24],
    [192, 46, 22],
    [218, 34, 26],
    [248, 50, 20],
    [272, 38, 24],
    [300, 46, 22],
    [326, 32, 26],
    [356, 48, 20],
    [380, 36, 24],
    [408, 44, 22],
    [434, 30, 22],
  ];
  for (const [dx, th, tw] of towers) {
    cv.fillRect(x + dx, base - th, tw, th, [28, 22, 26]);
  }
  // Lit windows.
  for (let i = 0; i < 14; i++) {
    cv.fillRect(x + 8 + i * 32, base - 22 - ((i * 7) % 20), 3, 4, GOLD_LT);
  }
  // Blasts over the skyline.
  cv.burst(x + 96, y + 16, 14, GOLD_LT);
  cv.burst(x + 96, y + 16, 7, ORANGE);
  cv.burst(x + 330, y + 12, 11, GOLD_LT);
  cv.burst(x + 330, y + 12, 6, RED);
  // Smoke puffs.
  cv.disc(x + 116, y + 8, 5, [120, 116, 112]);
  cv.disc(x + 344, y + 6, 4, [120, 116, 112]);
}

function iconSummit(cv: Canvas, x: number, y: number, w: number, h: number): void {
  // Three flags on poles above a round table: US, China, Russia.
  cv.fillRect(x, y, w, h, [232, 228, 214]);
  // Round table.
  cv.ellipse(x + 228, y + 52, 190, 9, [146, 110, 62]);
  cv.ellipse(x + 228, y + 50, 190, 9, [178, 140, 86]);
  const poleY0 = y + 8;
  const poleY1 = y + 50;
  const flagW = 52;
  const flagH = 26;
  const positions = [x + 96, x + 202, x + 308];
  for (const px of positions) {
    cv.fillRect(px, poleY0, 3, poleY1 - poleY0, [90, 80, 60]);
    cv.disc(px + 1, poleY0 - 1, 3, GOLD);
  }
  // US flag: stripes + blue canton.
  const us = positions[0] + 3;
  for (let i = 0; i < 7; i++) {
    cv.fillRect(us, y + 10 + i * 4, flagW, 2, i % 2 === 0 ? RED : WHITE);
  }
  cv.fillRect(us, y + 10, 22, 14, BLUE);
  cv.disc(us + 11, y + 17, 2, WHITE);
  // China flag: red field, yellow stars.
  const cn = positions[1] + 3;
  cv.fillRect(cn, y + 10, flagW, flagH, RED);
  cv.disc(cn + 10, y + 18, 4, GOLD_LT);
  cv.disc(cn + 26, y + 15, 2, GOLD_LT);
  cv.disc(cn + 32, y + 21, 2, GOLD_LT);
  cv.disc(cn + 26, y + 27, 2, GOLD_LT);
  // Russia flag: white, blue, red bands.
  const ru = positions[2] + 3;
  cv.fillRect(ru, y + 10, flagW, 9, WHITE);
  cv.fillRect(ru, y + 19, flagW, 9, BLUE);
  cv.fillRect(ru, y + 28, flagW, 8, RED);
  // Olive branch on the table.
  cv.line(x + 168, y + 50, x + 288, y + 50, 2, GREEN);
  cv.ellipse(x + 196, y + 46, 8, 3, GREEN);
  cv.ellipse(x + 260, y + 46, 8, 3, GREEN);
}

function iconCop(cv: Canvas, x: number, y: number, w: number, h: number): void {
  // Globe with a rising thermometer and a leaf.
  cv.fillRect(x, y, w, h, SKY);
  const cx = x + 84;
  const cy = y + 30;
  cv.disc(cx, cy, 24, [46, 125, 190]);
  cv.disc(cx - 8, cy - 6, 7, GREEN);
  cv.disc(cx + 6, cy + 8, 8, GREEN);
  cv.disc(cx + 12, cy - 10, 4, GREEN);
  // Thermometer.
  const tx = x + 210;
  cv.fillRect(tx, y + 6, 10, 40, WHITE);
  cv.border(tx, y + 6, 10, 40, 2, INK);
  cv.fillRect(tx + 2, y + 20, 6, 24, RED);
  cv.disc(tx + 5, y + 48, 8, RED);
  cv.disc(tx + 5, y + 48, 4, [255, 120, 120]);
  // Sun with rays.
  const sx = x + 300;
  const sy = y + 16;
  cv.disc(sx, sy, 9, GOLD_LT);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    cv.line(
      sx + Math.round(Math.cos(a) * 12),
      sy + Math.round(Math.sin(a) * 12),
      sx + Math.round(Math.cos(a) * 18),
      sy + Math.round(Math.sin(a) * 18),
      2,
      GOLD,
    );
  }
  // Leaf.
  cv.ellipse(x + 380, y + 42, 16, 7, GREEN);
  cv.line(x + 364, y + 42, x + 396, y + 42, 2, [11, 94, 47]);
  // Rising arrow.
  cv.line(x + 150, y + 48, x + 178, y + 20, 3, RED);
  cv.line(x + 178, y + 20, x + 168, y + 22, 3, RED);
  cv.line(x + 178, y + 20, x + 176, y + 30, 3, RED);
}

function iconMarkets(cv: Canvas, x: number, y: number, w: number, h: number): void {
  // Falling bars and a down arrow on a trading-floor board.
  cv.fillRect(x, y, w, h, [30, 38, 52]);
  const base = y + h - 6;
  const bars: Array<[number, number]> = [
    [30, 40],
    [90, 32],
    [150, 24],
    [210, 16],
    [270, 10],
  ];
  for (const [dx, bh] of bars) {
    cv.fillRect(x + dx, base - bh, 34, bh, RED);
    cv.fillRect(x + dx, base - bh, 34, 3, [255, 120, 120]);
  }
  // Down-trend arrow.
  cv.line(x + 330, y + 8, x + 430, y + 44, 5, GOLD_LT);
  cv.line(x + 430, y + 44, x + 408, y + 42, 5, GOLD_LT);
  cv.line(x + 430, y + 44, x + 428, y + 22, 5, GOLD_LT);
  // "-3.7%" tag.
  drawText(cv, x + 336, y + 46, "-3.7%", 1, WHITE);
}

function iconUkEu(cv: Canvas, x: number, y: number, w: number, h: number): void {
  // EU circle of stars and the Union Jack, joined by a gold bridge arc.
  cv.fillRect(x, y, w, h, [232, 228, 214]);
  // EU flag.
  const ex = x + 90;
  const ey = y + 30;
  cv.fillRect(ex - 52, y + 8, 104, 44, BLUE);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12 - Math.PI / 2;
    cv.disc(Math.round(ex + Math.cos(a) * 15), Math.round(ey + Math.sin(a) * 15), 2, GOLD_LT);
  }
  // Union Jack (simplified: blue field, white cross, red cross).
  const ux = x + 300;
  const uy = y + 8;
  cv.fillRect(ux, uy, 104, 44, [18, 44, 110]);
  cv.line(ux, uy, ux + 104, uy + 44, 6, WHITE);
  cv.line(ux + 104, uy, ux, uy + 44, 6, WHITE);
  cv.line(ux, uy, ux + 104, uy + 44, 2, RED);
  cv.line(ux + 104, uy, ux, uy + 44, 2, RED);
  cv.fillRect(ux + 48, uy, 8, 44, WHITE);
  cv.fillRect(ux, uy + 18, 104, 8, WHITE);
  cv.fillRect(ux + 50, uy, 4, 44, RED);
  cv.fillRect(ux, uy + 20, 104, 4, RED);
  // Gold bridge arc joining them.
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const px = Math.round(x + 158 + t * 128);
    const py = Math.round(y + 52 - Math.sin(t * Math.PI) * 26);
    cv.disc(px, py, 2, GOLD);
  }
}

const STORIES: Story[] = [
  {
    kicker: "EUROPE - NATO ALERT",
    kickerColor: RED,
    headline: "MISSILES LAND IN POLAND",
    summary:
      "Two Russian missiles and a drone fell in Poland. Warsaw calls it deliberate; NATO calls it a grave violation.",
    accent: RED,
    band: [24, 30, 54],
    icon: iconPoland,
  },
  {
    kicker: "UKRAINE - WAR",
    kickerColor: ORANGE,
    headline: "RUSSIA POUNDS KYIV",
    summary:
      "Strikes hit three Kyiv bridges; at least nine killed. Kryvyi Rih: two dead, 42 hurt, four of them children.",
    accent: ORANGE,
    band: [52, 38, 44],
    icon: iconKyiv,
  },
  {
    kicker: "SHENZHEN - SUMMIT",
    kickerColor: BLUE,
    headline: "A 'PEACE DECLARATION' IN SHENZHEN",
    summary:
      "Trump, Xi and Putin meet in Shenzhen, pledge nuclear war 'cannot be won'. Few specifics; Ukraine unmentioned.",
    accent: BLUE,
    band: [232, 228, 214],
    icon: iconSummit,
  },
  {
    kicker: "ANTALYA - CLIMATE",
    kickerColor: GREEN,
    headline: "COP31 RUNS OVER TIME AS FOSSIL FUELS VANISH",
    summary:
      "Draft deal drops all mention of fossil fuels; Panama threatens a veto. Talks spill into Saturday over finance.",
    accent: GREEN,
    band: SKY,
    icon: iconCop,
  },
  {
    kicker: "MARKETS - NEW YORK",
    kickerColor: RED,
    headline: "WALL STREET SLIDES INTO CORRECTION",
    summary:
      "S&P 500 and Dow enter correction as AI shares plunge; US stocks fall about 3.7% in Friday's sell-off.",
    accent: RED,
    band: [30, 38, 52],
    icon: iconMarkets,
  },
  {
    kicker: "BRUSSELS - EUROPE",
    kickerColor: BLUE,
    headline: "UK AND EU SIGN POST-BREXIT DEALS",
    summary:
      "Summit seals deals on food trade, carbon markets and youth mobility in a new UK-EU reset.",
    accent: BLUE,
    band: [232, 228, 214],
    icon: iconUkEu,
  },
];

const TICKER: string[] = [
  "CYCLONE AKVAN SOAKS INDIA'S EAST COAST AFTER LANDFALL; 370,000 EVACUATED",
  "MONGOLIA TO ELECT NEW PRESIDENT AFTER KHURELSUKH QUITS IN GRAFT ROW",
  "WORLD COURT: MYANMAR COMMITTED GENOCIDE - DENMARK FOILS ASSASSINATION PLOT",
];

// ----------------------------------------------------------- layout ----
const W = 1024;
const H = 1024;

function drawPanel(cv: Canvas, x: number, y: number, w: number, h: number, s: Story): void {
  cv.fillRect(x, y, w, h, PANEL);
  cv.border(x, y, w, h, 2, INK);
  // Accent bar across the top.
  cv.fillRect(x + 2, y + 2, w - 4, 6, s.accent);
  // Icon band.
  const bandY = y + 8;
  const bandH = 60;
  s.icon(cv, x + 16, bandY, w - 32, bandH);
  cv.fillRect(x + 16, bandY + bandH, w - 32, 2, INK);
  // Kicker.
  const tx = x + 16;
  let cy = bandY + bandH + 12;
  drawText(cv, tx, cy, s.kicker, 2, s.kickerColor);
  cy += 22;
  // Headline, scale 3, up to two lines.
  const headLines = wrapText(s.headline, w - 32, 3);
  for (const ln of headLines) {
    drawText(cv, tx, cy, ln, 3, INK);
    cy += 27;
  }
  cy += 4;
  // Summary, scale 2, up to three lines.
  const sumLines = wrapText(s.summary, w - 32, 2);
  for (const ln of sumLines.slice(0, 3)) {
    drawText(cv, tx, cy, ln, 2, [52, 58, 74]);
    cy += 18;
  }
}

function drawMasthead(cv: Canvas): void {
  cv.fillRect(11, 11, W - 22, 157, NAVY);
  cv.fillRect(11, 165, W - 22, 3, GOLD);
  drawTextCentered(cv, W / 2, 28, "THE WORLD IN ONE DAY", 5, WHITE);
  cv.fillRect(212, 78, W - 424, 2, GOLD);
  drawTextCentered(cv, W / 2, 90, "SATURDAY 21 NOVEMBER 2026", 4, GOLD_LT);
  cv.fillRect(212, 128, W - 424, 2, GOLD);
  drawTextCentered(cv, W / 2, 140, "SIX STORIES FROM AROUND THE WORLD", 2, [200, 208, 224]);
}

function drawTicker(cv: Canvas): void {
  const y = 896;
  cv.fillRect(11, y, W - 22, 112, NAVY);
  cv.fillRect(11, y, W - 22, 3, GOLD);
  drawText(cv, 28, y + 14, "ALSO TODAY", 2, GOLD_LT);
  const lines = TICKER;
  for (let i = 0; i < lines.length; i++) {
    drawText(cv, 28, y + 40 + i * 24, "• " + lines[i], 2, WHITE);
  }
}

function buildImage(): Buffer {
  const cv = new Canvas(W, H, PAPER);
  cv.border(8, 8, W - 16, H - 16, 3, INK);
  drawMasthead(cv);
  // 2 columns x 3 rows of story panels.
  const px = [16, 520];
  const py = [176, 416, 656];
  for (let i = 0; i < STORIES.length; i++) {
    drawPanel(cv, px[i % 2], py[Math.floor(i / 2)], 488, 232, STORIES[i]);
  }
  drawTicker(cv);
  return encodePNG(W, H, cv.px);
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const png = buildImage();
  const outPath = outDir + "/entry.png";
  fs.writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes)`);
}

main();
