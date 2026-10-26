# CineHub: setup (Codespaces + GitHub Actions)

## 0. Before you start
- Supabase: SQL (supabase.sql) already run, Email login on, Confirm email off.
- Open src/config.ts and paste your TMDB key in TMDB_KEY.

## 1. Codespaces: unzip
Upload cinehub.zip into the Codespace (drag it into the Explorer, repo root), then in the terminal:

    cd /workspaces/cinehub
    unzip -o cinehub.zip && rm cinehub.zip

## 2. (Optional, 3-5 min) Catch errors early, no Android SDK needed

    npm install
    npx expo install expo-status-bar expo-linear-gradient expo-video expo-build-properties react-native-svg react-native-screens react-native-safe-area-context @react-native-async-storage/async-storage
    npx expo install --fix
    npx expo export --platform android

If this ends with "Exported", the code bundles fine.

## 3. Build the APK (GitHub does it)

    git add -A
    git commit -m "CineHub full app"
    git push

Open the repo on GitHub > Actions > "Build APK". After about 10-15 minutes
the APK appears in the repo's Releases (CineHub.apk) and under the run's Artifacts.

## 4. Make yourself admin (once)
Open the app, Sign up with your email, then in Supabase > SQL Editor run:

    update public.profiles set role = 'admin' where email = 'YOUR_EMAIL_HERE';

Close and reopen the app: Profile > Manage plugins.

## 5. NEW in v3: update system, Android TV, premium downloads
- Re-run supabase.sql once (the new part at the bottom creates the app_config table).
- Install a new version: build the APK, then Profile > Publish app update. Paste
  https://github.com/YOU/REPO/releases/latest/download/CineHub.apk, type the new version
  (also change APP_VERSION in src/theme.ts and "version" in app.json to the same number), keep Force update on.
  Phones with an older version are blocked until they update inside the app.
- Android TV: the same APK works. Install it on the TV (adb or a USB file manager); CineHub appears on the TV home screen.
