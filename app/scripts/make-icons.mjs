/**
 * Generates the PWA icon set from public/logo.jpg.
 *
 *   node scripts/make-icons.mjs
 *
 * Committed so the icons can be regenerated if the logo is ever redrawn.
 * The source is 1408x768 with the duck centred near x=765; the square crop
 * below frames it with a little breathing room.
 */
import sharp from "sharp";

const SRC = "public/logo.jpg";

// A square cut from the 1408x768 source, centred on the duck.
const SQUARE = { left: 380, top: 0, width: 768, height: 768 };

/** Brand blue from ../styles.css, so the icon matches the rest of Fludd. */
const BRAND = { r: 11, g: 107, b: 203, alpha: 1 };

const square = await sharp(SRC).extract(SQUARE).png().toBuffer();

/**
 * Cuts the duck out of the logo's blue background.
 *
 * The source is a flat-colour illustration on a near-solid blue gradient, and
 * the duck contains no blue at all — its darkest tone is navy rgb(27,36,44),
 * far from the background's rgb(~10,101,165). So a colour-distance key
 * separates them cleanly, with a feathered band so edges stay smooth.
 *
 * Doing this is what lets the duck be inset on a flat tile without a seam:
 * pasting an opaque crop of a gradient onto a flat colour always shows its edge.
 */
async function cutout(buffer) {
  const img = sharp(buffer).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const ref = { r: 10, g: 101, b: 165 };
  const SOLID = 46;
  const FEATHER = 74;

  for (let i = 0; i < data.length; i += info.channels) {
    const d = Math.hypot(data[i] - ref.r, data[i + 1] - ref.g, data[i + 2] - ref.b);
    if (d < SOLID) data[i + 3] = 0;
    else if (d < FEATHER) {
      data[i + 3] = Math.round(((d - SOLID) / (FEATHER - SOLID)) * 255);
    }
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toBuffer();
}

const duck = await cutout(square);
const trimmed = await sharp(duck).trim().png().toBuffer();

/** The duck centred on brand blue, occupying `fill` of the tile. */
async function icon(size, fill, out) {
  const box = Math.round(size * fill);
  const inner = await sharp(trimmed)
    .resize(box, box, { fit: "inside" })
    .png()
    .toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background: BRAND } })
    .composite([{ input: inner, gravity: "centre" }])
    .png()
    .toFile(out);
  console.log(`wrote ${out}`);
}

// "any" icons nearly fill the tile, as a home screen icon should.
await icon(192, 0.84, "public/icon-192.png");
await icon(512, 0.84, "public/icon-512.png");

// Android crops maskable icons to a circle or squircle and only guarantees the
// middle 80%, so the duck is inset further to keep it whole.
await icon(512, 0.58, "public/icon-maskable-512.png");

// iOS home screen. Square with no rounding of its own — iOS applies the
// squircle itself, and a pre-rounded source ends up rounded twice.
await icon(180, 0.84, "public/apple-touch-icon.png");
