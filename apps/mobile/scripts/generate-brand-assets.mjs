// Genera los iconos de la app a partir de la mascota (fuente unica).
// Uso: node scripts/generate-brand-assets.mjs (desde apps/mobile)
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "../web/public/devil-icon.png");
const assets = resolve(root, "assets");
const preview = resolve(assets, ".preview");
mkdirSync(preview, { recursive: true });

const NAVY = "#0F1B3D";
const SAFE_SCALE = 0.56; // la zona segura adaptativa es el 61 % central

// Mascota escalada a `box` px de ancho/alto maximo (lanczos3), con alfa.
const mascot = (box) =>
  sharp(source)
    .resize(box, box, { fit: "inside", kernel: "lanczos3" })
    .png()
    .toBuffer();

// Mascota centrada en un lienzo cuadrado transparente.
async function centered(size, scale) {
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: await mascot(Math.round(size * scale)), gravity: "centre" }])
    .png();
}

// Silueta blanca pura: RGB 255 con el alfa de la imagen.
async function whiteSilhouette(input) {
  const alpha = await sharp(input).ensureAlpha().extractChannel(3).toBuffer();
  return sharp({
    create: { width: (await sharp(input).metadata()).width, height: (await sharp(input).metadata()).height, channels: 3, background: "#ffffff" },
  })
    .joinChannel(alpha)
    .png();
}

const write = (img, name) => img.toFile(resolve(assets, name));

// Primer plano adaptativo (512, como la plantilla) y monocromo (432)
await write(await centered(512, SAFE_SCALE), "android-icon-foreground.png");
const mono = await whiteSilhouette(await (await centered(432, SAFE_SCALE)).toBuffer());
await write(mono, "android-icon-monochrome.png");

// Splash: mascota sobre lienzo transparente 1024
await write(await centered(1024, 0.8), "splash-icon.png");

// Icono de notificacion: silueta blanca recortada, 96x96 con 8 % de margen
const trimmed = await sharp(source).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 }).toBuffer();
const inner = Math.round(96 * (1 - 0.16));
const notif = await sharp(trimmed).resize(inner, inner, { fit: "inside", kernel: "lanczos3" }).png().toBuffer();
const notifCanvas = await sharp({
  create: { width: 96, height: 96, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: notif, gravity: "centre" }])
  .png()
  .toBuffer();
await write(await whiteSilhouette(notifCanvas), "notification-icon.png");

// Icono de tienda 1024, sobre Navy, sin alfa. Mascota ocupa 56 % (zona segura).
const iconBuf = await sharp({
  create: { width: 1024, height: 1024, channels: 3, background: NAVY },
})
  .composite([{ input: await mascot(Math.round(1024 * SAFE_SCALE)), gravity: "centre" }])
  .removeAlpha()
  .png()
  .toBuffer();
await write(sharp(iconBuf), "icon.png");

// Vista previa: circulo, cuadrado redondeado y squircle
const P = 256;
const masks = {
  circle: `<circle cx="${P / 2}" cy="${P / 2}" r="${P / 2}"/>`,
  rounded: `<rect width="${P}" height="${P}" rx="${P * 0.18}"/>`,
  squircle: `<path d="M${P / 2} 0C${P * 0.9} 0 ${P} ${P * 0.1} ${P} ${P / 2}S${P * 0.9} ${P} ${P / 2} ${P}S0 ${P * 0.9} 0 ${P / 2}S${P * 0.1} 0 ${P / 2} 0Z"/>`,
};
const small = await sharp(iconBuf).resize(P, P).png().toBuffer();
const tiles = await Promise.all(
  Object.values(masks).map((m) =>
    sharp(small)
      .composite([{ input: Buffer.from(`<svg width="${P}" height="${P}">${m}</svg>`), blend: "dest-in" }])
      .png()
      .toBuffer(),
  ),
);
await sharp({
  create: { width: P * 3 + 40, height: P + 20, channels: 4, background: "#cccccc" },
})
  .composite(tiles.map((input, i) => ({ input, left: 10 + i * (P + 10), top: 10 })))
  .png()
  .toFile(resolve(preview, "icon-preview.png"));

console.log("Activos de marca generados");
