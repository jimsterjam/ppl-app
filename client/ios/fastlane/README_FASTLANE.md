Fastlane quickstart for iOS (Capacitor)

Overview
--------
This Fastlane setup lives in `client/ios/fastlane` and provides two lanes:

- `fastlane beta` — builds the web assets, syncs Capacitor, archives the iOS app and uploads to TestFlight.
- `fastlane release` — runs screenshots capture, builds and uploads to App Store.

Prerequisites
-------------
- macOS with Xcode installed (recommended Xcode 15+).
- Ruby environment for Fastlane (system Ruby or use `rbenv`/`rvm`).
- Fastlane installed: `sudo gem install fastlane -NV` or via bundler.
- Logged in to App Store Connect / Apple Developer on Xcode and fastlane.

Setup
-----
1. Install fastlane (if not already):

```bash
cd client/ios
gem install fastlane -NV
# or use bundler and Gemfile if you prefer
```

2. Edit `Appfile` and replace placeholders:

- `app_identifier("com.pplapp.mobile")` -> keep or change to your app's bundle id
- `apple_id("your-apple-id@example.com")` -> set your Apple ID email
- optionally set `team_id("YOUR_TEAM_ID")`

3. Run a beta build (first run will prompt authentication):

```bash
cd client/ios
fastlane beta
```

Notes
-----
- The Fastfile runs `npm ci` and `npm run build` in the `client` folder — ensure your CI or local environment has network access and required Node version.
- The `build_app` step expects an Xcode project at `client/ios/App/App.xcodeproj` and a scheme named `App`. If your scheme name differs, update the Fastfile.
- For more robust signing (certs/profiles) consider `match` (fastlane match) to manage certificates across machines.

Security
--------
- Do not commit your `fastlane/report.xml` or any credentials. Use environment variables for sensitive data (FASTLANE_USER, FASTLANE_PASSWORD, FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD) or connect via App Store Connect API key.
