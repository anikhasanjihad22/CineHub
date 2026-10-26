// Makes the same APK installable and launchable on Android TV / Google TV:
//  - adds the TV launcher category (so CineHub shows on the TV home screen)
//  - says a touch screen and the leanback UI are optional
//  - adds the 320x180 TV banner
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

function manifest(config) {
  return withAndroidManifest(config, (c) => {
    const m = c.modResults.manifest;
    m['uses-feature'] = m['uses-feature'] || [];
    const addFeature = (name, required) => {
      if (!m['uses-feature'].some((f) => f.$['android:name'] === name)) {
        m['uses-feature'].push({ $: { 'android:name': name, 'android:required': String(required) } });
      }
    };
    addFeature('android.software.leanback', false);
    addFeature('android.hardware.touchscreen', false);

    const app = m.application[0];
    app.$['android:banner'] = '@drawable/tv_banner';
    const main = (app.activity || []).find((a) => a.$['android:name'] === '.MainActivity');
    if (main) {
      main['intent-filter'] = main['intent-filter'] || [];
      const launcher = main['intent-filter'].find((f) => (f.action || []).some((x) => x.$['android:name'] === 'android.intent.action.MAIN'));
      if (launcher) {
        launcher.category = launcher.category || [];
        if (!launcher.category.some((x) => x.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER')) {
          launcher.category.push({ $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } });
        }
      }
    }
    return c;
  });
}

function banner(config) {
  return withDangerousMod(config, ['android', async (c) => {
    const from = path.join(c.modRequest.projectRoot, 'assets', 'tv-banner.png');
    const dir = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'drawable');
    if (fs.existsSync(from)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(from, path.join(dir, 'tv_banner.png'));
    }
    return c;
  }]);
}

module.exports = (config) => banner(manifest(config));
