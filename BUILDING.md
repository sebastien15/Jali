# Jali — Android Build Reference

## How builds work

Builds run automatically on every push to `main` via GitHub Actions (`.github/workflows/build-android.yml`).
The APK is uploaded as a build artifact — download it from the Actions tab on GitHub.

Manual trigger: GitHub → Actions → Build Android APK → Run workflow.

---

## ABI (CPU Architecture) targets

The `reactNativeArchitectures` property in `gradle.properties` controls which CPU architectures
the native C++ code (reanimated, worklets, etc.) is compiled for.
More architectures = longer build time.

| ABI | Devices | Notes |
|---|---|---|
| `arm64-v8a` | All modern Android phones (2017+) | **Current setting** — Samsung S-series, Pixel, OnePlus, etc. |
| `armeabi-v7a` | Old 32-bit ARM phones (pre-2017) | Very rare today |
| `x86_64` | Android emulators on Intel/AMD Macs | Needed if testing on emulator |
| `x86` | Old 32-bit emulators | Not needed |

### When to change the ABI setting

**Testing on a physical phone (current):**
```
reactNativeArchitectures=arm64-v8a
```
Fastest builds (~10–15 min). Works on all real phones made since 2017.

**Testing on an Android emulator (Mac/Windows Intel):**
```
reactNativeArchitectures=arm64-v8a,x86_64
```

**Submitting to Google Play Store:**
```
reactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64
```
Play Store serves the right ABI per device automatically (AAB splits).
For Play Store, switch from `assembleRelease` to `bundleRelease` to produce an `.aab` file.

To change it, edit the workflow step **"Set up release keystore and limit ABI to arm64-v8a"**
and update the `reactNativeArchitectures=` line.

---

## GitHub Secrets required

| Secret | Description |
|---|---|
| `RELEASE_KEYSTORE_BASE64` | Base64-encoded `~/.android/debug.keystore` |
| `KEYSTORE_PASSWORD` | Keystore password (`android` for debug keystore) |
| `KEY_ALIAS` | Key alias (`androiddebugkey` for debug keystore) |
| `KEY_PASSWORD` | Key password (`android` for debug keystore) |

To re-encode the keystore: `base64 -i ~/.android/debug.keystore | pbcopy`

---

## Play Store checklist (when ready)

- [ ] Generate a production keystore (not the debug one) with `keytool -genkeypair`
- [ ] Register its SHA-1 and SHA-256 in Firebase Console → Android app → SHA fingerprints
- [ ] Download updated `google-services.json` and commit it
- [ ] Update GitHub Secrets with the production keystore
- [ ] Change `assembleRelease` → `bundleRelease` in the workflow
- [ ] Change artifact path to `app/build/outputs/bundle/release/app-release.aab`
- [ ] Set `reactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64`
- [ ] Enable Play App Signing in the Play Console
