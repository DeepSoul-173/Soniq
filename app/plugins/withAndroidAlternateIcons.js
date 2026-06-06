/**
 * withAndroidAlternateIcons — Expo config plugin
 *
 * Does two things during `expo prebuild` / EAS build:
 *
 *  1. Manifest step (withAndroidManifest):
 *     Adds three <activity-alias> entries to AndroidManifest.xml.
 *     Each alias starts with android:enabled="false"; AppIconService
 *     enables the correct one at runtime via PackageManager.
 *
 *  2. Image step (withDangerousMod):
 *     Reads each source PNG from assets/icons/ and writes it into
 *     every Android mipmap-* density directory so AAPT can find
 *     the resources referenced by the manifest.
 *
 * Source images required (create with: node scripts/generate-placeholder-icons.js):
 *   assets/icons/icon-dark.png
 *   assets/icons/icon-neon.png
 *   assets/icons/icon-gold.png
 *
 * Icon resource names in the manifest (must match VARIANTS below):
 *   @mipmap/ic_launcher_dark
 *   @mipmap/ic_launcher_neon
 *   @mipmap/ic_launcher_gold
 */

const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const { generateImageAsync } = require('@expo/image-utils');
const fs   = require('fs');
const path = require('path');

// ── Configuration ─────────────────────────────────────────────────────────────

const VARIANTS = [
  {
    suffix:   'Dark',
    resource: '@mipmap/ic_launcher_dark',
    alias:    '.MainActivityIconDark',
    src:      'assets/icons/icon-dark.png',
    resName:  'ic_launcher_dark',
  },
  {
    suffix:   'Neon',
    resource: '@mipmap/ic_launcher_neon',
    alias:    '.MainActivityIconNeon',
    src:      'assets/icons/icon-neon.png',
    resName:  'ic_launcher_neon',
  },
  {
    suffix:   'Gold',
    resource: '@mipmap/ic_launcher_gold',
    alias:    '.MainActivityIconGold',
    src:      'assets/icons/icon-gold.png',
    resName:  'ic_launcher_gold',
  },
];

// Android adaptive icon densities: directory → side length in dp-equivalent px
const MIPMAP_DENSITIES = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

// ── Step 1: AndroidManifest.xml ───────────────────────────────────────────────

function makeAlias(variant, mainActivityName) {
  return {
    $: {
      'android:name':           variant.alias,
      'android:enabled':        'false',
      'android:exported':       'true',
      'android:icon':           variant.resource,
      'android:targetActivity': mainActivityName,
    },
    'intent-filter': [
      {
        action:   [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      },
    ],
  };
}

function withAlternateIconsManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest?.application?.[0];
    if (!application) return mod;

    const mainActivity = (application.activity || []).find(
      (a) => a.$?.['android:name']?.endsWith('MainActivity')
    );
    const mainName = mainActivity?.$?.['android:name'] || '.MainActivity';

    if (!application['activity-alias']) application['activity-alias'] = [];

    for (const variant of VARIANTS) {
      const alreadyAdded = application['activity-alias'].some(
        (a) => a.$?.['android:name'] === variant.alias
      );
      if (!alreadyAdded) {
        application['activity-alias'].push(makeAlias(variant, mainName));
      }
    }

    return mod;
  });
}

// ── Step 2: Mipmap image files ────────────────────────────────────────────────

function withAlternateIconImages(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const projectRoot = mod.modRequest.projectRoot;
      const resDir = path.join(
        mod.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'res'
      );

      for (const variant of VARIANTS) {
        const srcAbs = path.join(projectRoot, variant.src);

        if (!fs.existsSync(srcAbs)) {
          console.warn(
            `[withAndroidAlternateIcons] Source image not found: ${srcAbs}\n` +
            `  Run: node scripts/generate-placeholder-icons.js`
          );
          continue;
        }

        for (const { dir, size } of MIPMAP_DENSITIES) {
          const destDir  = path.join(resDir, dir);
          const destFile = path.join(destDir, `${variant.resName}.png`);

          // Ensure the density directory exists (may not on first prebuild)
          fs.mkdirSync(destDir, { recursive: true });

          // Use @expo/image-utils to resize the source image.
          // generateImageAsync writes a cached file; we read that buffer
          // and write it to the final destination ourselves.
          const { source } = await generateImageAsync(
            { projectRoot, cacheType: `soniq-alt-icon-${variant.resName}-${size}` },
            {
              src:        srcAbs,
              name:       `${variant.resName}-${size}.png`,
              resizeMode: 'cover',
              width:      size,
              height:     size,
            }
          );

          fs.writeFileSync(destFile, source);
          // eslint-disable-next-line no-console
          console.log(`[withAndroidAlternateIcons] wrote ${dir}/${variant.resName}.png (${size}px)`);
        }
      }

      return mod;
    },
  ]);
}

// ── Compose both modifications into one plugin ────────────────────────────────

module.exports = function withAndroidAlternateIcons(config) {
  config = withAlternateIconsManifest(config);
  config = withAlternateIconImages(config);
  return config;
};
