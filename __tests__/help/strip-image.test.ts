import { crc32 } from "node:zlib";
import { stripImageMetadata, ScreenshotReject } from "@/lib/help/strip-image";

describe("stripImageMetadata", () => {
  it("removes a JPEG APP1 EXIF segment and keeps the frame markers", () => {
    const jpeg = Uint8Array.from([
      0xff, 0xd8,
      0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
      0xff, 0xd9,
    ]);
    const stripped = stripImageMetadata(jpeg);
    expect(stripped.contentType).toBe("image/jpeg");
    expect(Array.from(stripped.bytes)).toEqual([0xff, 0xd8, 0xff, 0xd9]);
    expect(Array.from(stripped.bytes).includes(0xe1)).toBe(false);
  });

  it("drops a PNG text chunk and keeps IHDR and IEND", () => {
    const signature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = pngChunk("IHDR", Uint8Array.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]));
    const text = pngChunk("tEXt", Uint8Array.from([0x47, 0x50, 0x53, 0]));
    const iend = pngChunk("IEND", new Uint8Array());
    const png = concat([signature, ihdr, text, iend]);
    const stripped = stripImageMetadata(png);
    expect(stripped.extension).toBe("png");
    expect(Buffer.from(stripped.bytes).toString("utf8")).not.toContain("GPS");
    expect(stripped.bytes[stripped.bytes.length - 8]).toBe("I".charCodeAt(0));
  });

  it("drops a WebP EXIF chunk and keeps the image chunk", () => {
    const image = webpChunk("VP8 ", Uint8Array.from([9, 9]));
    const exif = webpChunk("EXIF", Uint8Array.from([1, 2, 3, 4]));
    const body = concat([exif, image]);
    const riff = new Uint8Array(12 + body.length);
    riff.set(Uint8Array.from("RIFF", (char) => char.charCodeAt(0)), 0);
    riff[4] = (4 + body.length) & 0xff;
    riff[5] = ((4 + body.length) >> 8) & 0xff;
    riff.set(Uint8Array.from("WEBP", (char) => char.charCodeAt(0)), 8);
    riff.set(body, 12);

    const stripped = stripImageMetadata(riff);
    expect(stripped.extension).toBe("webp");
    expect(Buffer.from(stripped.bytes).toString("utf8")).not.toContain("EXIF");
    expect(Buffer.from(stripped.bytes).toString("utf8")).toContain("VP8 ");
  });

  it("rejects an empty file, a non-image, and a file over 2 MB", () => {
    expect(() => stripImageMetadata(new Uint8Array())).toThrow(ScreenshotReject);
    expect(() => stripImageMetadata(Uint8Array.from([1, 2, 3, 4]))).toThrow(
      "The selected file must be a PNG, JPEG, or WebP.",
    );
    expect(() => stripImageMetadata(new Uint8Array(2 * 1024 * 1024 + 1))).toThrow(
      "The selected file must be smaller than 2 MB.",
    );
  });
});

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(Uint8Array.from(type, (char) => char.charCodeAt(0)), 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)) >>> 0);
  return chunk;
}

function webpChunk(fourcc: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(8 + data.length + (data.length % 2));
  chunk.set(Uint8Array.from(fourcc, (char) => char.charCodeAt(0)), 0);
  chunk[4] = data.length & 0xff;
  chunk[5] = (data.length >> 8) & 0xff;
  chunk.set(data, 8);
  return chunk;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
