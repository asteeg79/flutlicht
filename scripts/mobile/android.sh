#!/usr/bin/env bash
# Android-Emulator mit echtem Chrome für Sichtprüfungen (docs/mobil-testen.md).
#   scripts/mobile/android.sh start   Emulator starten, Chrome vorbereiten, Ports weiterleiten
#   scripts/mobile/android.sh stop    Emulator beenden
# Einmalige Einrichtung: brew install openjdk@21 android-commandlinetools, danach
#   sdkmanager "platform-tools" "emulator" "system-images;android-35;google_apis_playstore;arm64-v8a"
#   avdmanager create avd -n flutlicht-pixel7 -k "system-images;android-35;google_apis_playstore;arm64-v8a" -d pixel_7
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
AVD="${AVD:-flutlicht-pixel7}"
PORT="${PORT:-3100}"
ADB="$ANDROID_HOME/platform-tools/adb"

case "${1:-}" in
  start)
    if ! "$ADB" devices | grep -q "^emulator-"; then
      "$ANDROID_HOME/emulator/emulator" -avd "$AVD" -no-window -no-audio -no-boot-anim \
        -no-snapshot-save -gpu swiftshader_indirect >/tmp/flutlicht-emulator.log 2>&1 &
    fi
    "$ADB" wait-for-device
    until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 3; done
    # Chrome ohne Begrüßung und Benachrichtigungs-Dialog; als Debug-App liest es die Startoptionen.
    "$ADB" shell am set-debug-app --persistent com.android.chrome
    "$ADB" shell 'echo "_ --disable-fre --no-default-browser-check --no-first-run" > /data/local/tmp/chrome-command-line'
    "$ADB" shell pm grant com.android.chrome android.permission.POST_NOTIFICATIONS
    "$ADB" shell am force-stop com.android.chrome
    "$ADB" shell am start -n com.android.chrome/com.google.android.apps.chrome.Main \
      -a android.intent.action.VIEW -d "http://localhost:$PORT/login" >/dev/null
    # localhost im Emulator = localhost auf dem Mac; DevTools von Chrome auf Port 9222.
    "$ADB" reverse "tcp:$PORT" "tcp:$PORT" >/dev/null
    sleep 5
    "$ADB" forward tcp:9222 localabstract:chrome_devtools_remote >/dev/null
    echo "Android-Emulator bereit (Chrome auf http://localhost:$PORT, DevTools :9222)"
    ;;
  stop)
    "$ADB" emu kill 2>/dev/null || true
    ;;
  *)
    echo "Aufruf: $0 start|stop" >&2
    exit 1
    ;;
esac
