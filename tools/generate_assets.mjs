import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let i = 0; i < 8; i += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
}

// Night-shift theme: rounded navy tile, warm crescent moon, coral alert dot.
// Shapes are drawn with signed-distance coverage for smooth anti-aliased edges at every size.
function icon(size) {
  const px = 1 / size;
  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const circle = (u, v, cx, cy, r) => clamp01((r - Math.hypot(u - cx, v - cy)) / px / 1.5 + 0.5);
  const mix = (a, b, t) => a.map((channel, i) => channel + (b[i] - channel) * t);
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4); row[0] = 0;
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size, v = (y + 0.5) / size;
      // Rounded-rect tile coverage (alpha).
      const cornerRadius = 0.20;
      const dx = Math.max(Math.abs(u - 0.5) - (0.5 - cornerRadius), 0);
      const dy = Math.max(Math.abs(v - 0.5) - (0.5 - cornerRadius), 0);
      const cover = clamp01((cornerRadius - Math.hypot(dx, dy)) / px / 1.5 + 0.5);
      // Navy vertical gradient background.
      let rgb = mix([38, 48, 94], [21, 27, 58], v);
      // Crescent moon = big circle minus offset cut circle.
      const moon = clamp01(circle(u, v, 0.44, 0.55, 0.27) - circle(u, v, 0.56, 0.46, 0.24));
      rgb = mix(rgb, [255, 213, 110], moon);
      // Coral alert dot top-right, with a thin background ring so it reads on any backdrop.
      const ring = circle(u, v, 0.74, 0.28, 0.155);
      const dot = circle(u, v, 0.74, 0.28, 0.115);
      rgb = mix(rgb, mix([21, 27, 58], [255, 100, 92], dot), ring);
      const offset = 1 + x * 4;
      row.set([Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2]), Math.round(cover * 255)], offset);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}

function wav(frequency, amplitude, seconds = 1, fadeInSeconds = 0, continuous = false) {
  const sampleRate = 22050;
  const samples = sampleRate * seconds;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) {
    const fadeIn = fadeInSeconds > 0 ? Math.min(1, i / (sampleRate * fadeInSeconds)) : 1;
    const envelope = Math.max(0, 1 - i / samples) * fadeIn;
    const pulse = continuous || i < sampleRate * 0.72 ? Math.sin(2 * Math.PI * frequency * i / sampleRate) : 0;
    data.writeInt16LE(Math.round(pulse * envelope * amplitude * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

mkdirSync("assets/audio", { recursive: true });
for (const size of [16, 32, 48, 128]) writeFileSync(`assets/icon${size}.png`, icon(size));
const tones = [["soft", 520, 0.25], ["medium", 700, 0.4], ["loud", 880, 0.65], ["urgent", 1100, 0.85]];
for (const [name, frequency, amplitude] of tones) writeFileSync(`assets/audio/alert_${name}.wav`, wav(frequency, amplitude));
writeFileSync("assets/audio/gentle_loop.wav", wav(320, 0.22, 24, 4, true));
