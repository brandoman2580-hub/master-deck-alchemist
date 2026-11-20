import { SCREENSHOT_MAX_BYTES, screenshotErrorMessage } from "@/lib/help/feedback";

export class ScreenshotReject extends Error {
  readonly messageText: string;

  constructor(kind: "empty" | "type" | "too-big") {
    const messageText = screenshotErrorMessage(kind);
    super(messageText);
    this.name = "ScreenshotReject";
    this.messageText = messageText;
  }
}

export type StrippedScreenshot = {
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

/**
 * Keep the image and drop EXIF, XMP, and PNG text chunks.
 * The bytes are checked again after the strip so a polyglot cannot change type.
 */
export function stripImageMetadata(input: Uint8Array): StrippedScreenshot {
  if (input.byteLength === 0) throw new ScreenshotReject("empty");
  if (input.byteLength > SCREENSHOT_MAX_BYTES) throw new ScreenshotReject("too-big");

  if (isJpeg(input)) {
    const bytes = stripJpeg(input);
    if (!isJpeg(bytes)) throw new ScreenshotReject("type");
    return { bytes, contentType: "image/jpeg", extension: "jpg" };
  }
  if (isPng(input)) {
    const bytes = stripPng(input);
    if (!isPng(bytes)) throw new ScreenshotReject("type");
    return { bytes, contentType: "image/png", extension: "png" };
  }
  if (isWebp(input)) {
    const bytes = stripWebp(input);
    if (!isWebp(bytes)) throw new ScreenshotReject("type");
    return { bytes, contentType: "image/webp", extension: "webp" };
  }
  throw new ScreenshotReject("type");
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  );
}

/** Drop APP1 (EXIF and XMP). Leave the scan data intact. */
function stripJpeg(input: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < input.length) {
    if (input[i] !== 0xff) {
      pushRange(out, input, i, input.length);
      break;
    }
    while (i < input.length && input[i] === 0xff) i += 1;
    if (i >= input.length) break;
    const marker = input[i];
    i += 1;
    if (marker === 0xd9) {
      out.push(0xff, marker);
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker);
      continue;
    }
    if (i + 1 >= input.length) throw new ScreenshotReject("type");
    const length = (input[i] << 8) | input[i + 1];
    if (length < 2 || i + length > input.length) throw new ScreenshotReject("type");
    if (marker === 0xda) {
      out.push(0xff, marker);
      pushRange(out, input, i, input.length);
      break;
    }
    if (marker !== 0xe1) {
      out.push(0xff, marker);
      pushRange(out, input, i, i + length);
    }
    i += length;
  }
  return Uint8Array.from(out);
}

const PNG_TEXT_CHUNKS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function stripPng(input: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [input.slice(0, 8)];
  let i = 8;
  while (i + 12 <= input.length) {
    const length = readUint32BE(input, i);
    const type = ascii(input, i + 4, 4);
    const end = i + 12 + length;
    if (end > input.length) throw new ScreenshotReject("type");
    if (!PNG_TEXT_CHUNKS.has(type)) parts.push(input.slice(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return concat(parts);
}

function stripWebp(input: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= input.length) {
    const fourcc = ascii(input, i, 4);
    const size =
      input[i + 4] |
      (input[i + 5] << 8) |
      (input[i + 6] << 16) |
      (input[i + 7] << 24);
    const end = i + 8 + size + (size % 2);
    if (end > input.length) throw new ScreenshotReject("type");
    if (fourcc !== "EXIF" && fourcc !== "XMP ") kept.push(input.slice(i, end));
    i = end;
  }
  const body = concat(kept);
  const riff = new Uint8Array(12 + body.length);
  riff.set(asciiBytes("RIFF"), 0);
  writeUint32LE(riff, 4, 4 + body.length);
  riff.set(asciiBytes("WEBP"), 8);
  riff.set(body, 12);
  return riff;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function asciiBytes(value: string): Uint8Array {
  return Uint8Array.from(value, (char) => char.charCodeAt(0));
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function writeUint32LE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
  bytes[offset + 3] = (value >> 24) & 0xff;
}

function pushRange(out: number[], bytes: Uint8Array, start: number, end: number): void {
  for (let i = start; i < end; i += 1) out.push(bytes[i]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
