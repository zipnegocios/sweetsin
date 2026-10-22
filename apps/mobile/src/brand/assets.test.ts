import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const asset = (name: string) => resolve(root, "assets", name);

async function raw(path: string) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, info };
}

async function expectWhiteSilhouette(path: string) {
  const { data, info } = await raw(path);
  const total = info.width * info.height;
  let opaque = 0;
  let mismatches = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      opaque++;
      if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) mismatches++;
    }
  }
  expect(mismatches).toBe(0);
  expect(opaque / total).toBeGreaterThan(0.05);
  expect(opaque / total).toBeLessThan(0.6);
}

describe("activos de marca", () => {
  it("icon.png mide 1024x1024 y no tiene alfa", async () => {
    const meta = await sharp(asset("icon.png")).metadata();
    expect([meta.width, meta.height]).toEqual([1024, 1024]);
    expect(meta.hasAlpha).toBe(false);
  });

  it.each(["android-icon-foreground.png", "android-icon-monochrome.png"])(
    "%s es cuadrado y tiene alfa",
    async (name) => {
      const meta = await sharp(asset(name)).metadata();
      expect(meta.width).toBe(meta.height);
      expect(meta.hasAlpha).toBe(true);
    },
  );

  it("el icono monocromo es una silueta blanca", async () => {
    await expectWhiteSilhouette(asset("android-icon-monochrome.png"));
  });

  it("notification-icon.png mide 96x96 y es una silueta blanca", async () => {
    const meta = await sharp(asset("notification-icon.png")).metadata();
    expect([meta.width, meta.height]).toEqual([96, 96]);
    await expectWhiteSilhouette(asset("notification-icon.png"));
  });

  it.each(["isotipo.gif", "videologo.gif"])("%s existe y pesa <= 1 MB", (name) => {
    const path = asset(`brand/${name}`);
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeLessThanOrEqual(1024 * 1024);
  });
});

describe("app.json", () => {
  const { expo } = JSON.parse(readFileSync(resolve(root, "app.json"), "utf8"));
  const pluginOptions = (name: string) =>
    expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === name)?.[1];

  it("todas las rutas de imagen referenciadas existen", () => {
    const paths: string[] = [
      expo.icon,
      expo.android.adaptiveIcon.foregroundImage,
      expo.android.adaptiveIcon.monochromeImage,
      pluginOptions("expo-splash-screen").image,
      pluginOptions("expo-notifications").icon,
    ];
    for (const p of paths) {
      expect(existsSync(resolve(root, p)), p).toBe(true);
    }
  });

  it("usa Midnight Navy como fondo", () => {
    expect(expo.android.adaptiveIcon.backgroundColor).toBe("#0F1B3D");
    expect(pluginOptions("expo-splash-screen").backgroundColor).toBe("#0F1B3D");
  });
});
