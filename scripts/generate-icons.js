/**
 * generate-icons.js
 * Generates all Expo app icon assets from assets/images/logo-dark.png
 * Run: node scripts/generate-icons.js
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const LOGO = path.resolve(__dirname, "../assets/images/logo-dark.png");
const ASSETS = path.resolve(__dirname, "../assets");

// Accent color for Orio brand background
const BG_COLOR = { r: 10, g: 10, b: 15, alpha: 1 };       // #0A0A0F (dark mode brand bg)
const BG_COLOR_ANDROID = { r: 10, g: 10, b: 15, alpha: 1 }; // same

async function makeIconOnBg(size, outputPath, padding = 0.18, bg = BG_COLOR) {
  const logoSize = Math.round(size * (1 - padding * 2));

  // White logo on dark background (invert logo-dark so it shows white on dark bg)
  const logoBuffer = await sharp(LOGO)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .negate({ alpha: false })            // black → white symbol
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logoBuffer, gravity: "centre" }])
    .png()
    .toFile(outputPath);

  console.log(`✓ ${path.basename(outputPath)} (${size}x${size})`);
}

async function makeForeground(size, outputPath, padding = 0.18) {
  // Foreground for Android adaptive icon: logo (white) on transparent bg
  const logoSize = Math.round(size * (1 - padding * 2));

  const logoBuffer = await sharp(LOGO)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .negate({ alpha: false })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: logoBuffer, gravity: "centre" }])
    .png()
    .toFile(outputPath);

  console.log(`✓ ${path.basename(outputPath)} (${size}x${size})`);
}

async function makeBackground(size, outputPath, color = BG_COLOR_ANDROID) {
  await sharp({
    create: { width: size, height: size, channels: 4, background: color },
  })
    .png()
    .toFile(outputPath);

  console.log(`✓ ${path.basename(outputPath)} (${size}x${size}) — solid bg`);
}

async function makeMonochrome(size, outputPath) {
  // Monochrome = the symbol only (for Android themed icon)
  const logoBuffer = await sharp(LOGO)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp(logoBuffer).png().toFile(outputPath);
  console.log(`✓ ${path.basename(outputPath)} (${size}x${size}) — monochrome`);
}

async function makeFavicon(size, outputPath) {
  // Favicon: white logo on dark bg
  await makeIconOnBg(size, outputPath, 0.12);
}

(async () => {
  try {
    console.log("\n🎨 Orio Icon Generator\n");

    // Main icon (iOS + fallback) — 1024x1024
    await makeIconOnBg(1024, path.join(ASSETS, "icon.png"), 0.20);

    // Splash screen icon (centered, larger canvas)
    await makeIconOnBg(512, path.join(ASSETS, "splash-icon.png"), 0.15);

    // Favicon (web)
    await makeFavicon(196, path.join(ASSETS, "favicon.png"));

    // Android adaptive icon — foreground (1024, with transparency)
    await makeForeground(1024, path.join(ASSETS, "android-icon-foreground.png"), 0.22);

    // Android adaptive icon — background (solid brand color)
    await makeBackground(1024, path.join(ASSETS, "android-icon-background.png"));

    // Android monochrome (themed icon)
    await makeMonochrome(1024, path.join(ASSETS, "android-icon-monochrome.png"));

    console.log("\n✅ All icons generated successfully!\n");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
