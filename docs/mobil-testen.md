# Mobil testen

UI-Änderungen werden auf emulierten Handys geprüft, iPhone **und** Android. Zwei Stufen:

| Stufe | Wann | Womit | Engine |
|---|---|---|---|
| 1 | bei jeder Änderung, auch in der CI | Playwright-Geräteprofile (`e2e/devices.spec.ts`) | iPhone: WebKit, Android: Chromium |
| 2 | bei UI-Änderungen, lokal auf dem Mac | echte Simulatoren: Android-Emulator, iOS-Simulator | echtes Chrome bzw. Mobile Safari |

## Stufe 1: Playwright-Geräte

`pnpm --filter @fm/app test:e2e` führt erst die Abläufe mit Zustand auf dem Pixel 7 aus,
danach `e2e/devices.spec.ts` auf vier Geräten:

| Projekt | Profil | Breite | Engine |
|---|---|---|---|
| `iphone-15` | iPhone 15 | 393 px | WebKit |
| `iphone-se` | iPhone SE | 320 px | WebKit |
| `pixel-7` | Pixel 7 | 412 px | Chromium |
| `galaxy-s8` | Galaxy S8 | 360 px | Chromium |

Geprüft: kein seitliches Scrollen, Navigation und Kopfzeilen einzeilig, Formationsleiste,
kompaktes Auswahl-Sheet, rote Badges verschwinden. Screenshots je Gerät liegen in
`app/test-results/devices/<Gerät>/`, in der CI als Artefakt `geraete-screenshots`.

Einmalig lokal: `pnpm --filter @fm/app exec playwright install chromium webkit`.

## Stufe 2: Android-Emulator (echtes Chrome)

Einmalige Einrichtung (M4 Pro, ca. 8 GB):

```sh
brew install openjdk@21 android-commandlinetools
export JAVA_HOME=/opt/homebrew/opt/openjdk@21 ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
yes | sdkmanager --licenses
sdkmanager "platform-tools" "emulator" "platforms;android-35" "system-images;android-35;google_apis_playstore;arm64-v8a"
avdmanager create avd -n flutlicht-pixel7 -k "system-images;android-35;google_apis_playstore;arm64-v8a" -d pixel_7
```

Durchlauf:

```sh
pnpm --filter @fm/app test:e2e          # legt die Testdaten mit admin@e2e.test an
pnpm --filter @fm/app emulator:server   # Dev-Server mit diesen Testdaten auf :3100 (eigenes Terminal)
scripts/mobile/android.sh start         # Emulator ohne Fenster, Chrome vorbereitet
pnpm --filter @fm/app emulator:android  # anmelden, Seiten ansehen, Screenshots
scripts/mobile/android.sh stop
```

Screenshots (ganzes Gerät mit Statusleiste und Chrome-Leiste) liegen in
`app/test-results/emulator/android/`. Chrome wird über seine DevTools-Schnittstelle
gesteuert (`adb forward … chrome_devtools_remote`); Chrome-eigene Hinweise wie „Passwort
speichern?“ wischt das Skript weg. Anmelden per Enter, weil die Bildschirmtastatur die
Seite verschiebt. Das Abbild enthält Chrome 124; echte Geräte haben meist ein neueres.

## Stufe 2: iOS-Simulator (echtes Mobile Safari)

Einmalige Einrichtung (Xcode aus dem App Store, ca. 15 GB, dazu iOS-Umgebung ca. 8 GB):

```sh
sudo xcode-select -s /Applications/Xcode.app
sudo xcodebuild -license accept
xcodebuild -runFirstLaunch
xcodebuild -downloadPlatform iOS
```

Für die Abläufe [Maestro](https://maestro.mobile.dev) (braucht Java, s. o.): das offizielle
Release `maestro.zip` von GitHub nach `~/.maestro` entpacken. Das Skript schaltet die
Nutzungsstatistik von Maestro ab (`MAESTRO_CLI_NO_ANALYTICS=1`).

Durchlauf (Dev-Server wie bei Android):

```sh
scripts/mobile/ios.sh start             # Standard iPhone 17 (iOS 27), IOS_DEVICE=… für andere
pnpm --filter @fm/app emulator:ios      # e2e/emulator/ios.yaml: anmelden, Seiten, Screenshots
scripts/mobile/ios.sh stop
```

Screenshots liegen in `app/test-results/emulator/ios/<Zeitpunkt>/ios/takeScreenshot/`.
Der Simulator erreicht `localhost` des Macs direkt. Läuft gleichzeitig der Android-Emulator,
wählt `--platform ios` das richtige Gerät. Vor dem Tippen wartet der Ablauf, bis die
Tastatur steht, sonst gehen im Simulator die ersten Zeichen verloren.
