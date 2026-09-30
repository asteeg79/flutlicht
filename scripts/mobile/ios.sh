#!/usr/bin/env bash
# iOS-Simulator mit echtem Mobile Safari für Sichtprüfungen (docs/mobil-testen.md).
#   scripts/mobile/ios.sh start   Simulator starten (Standard: iPhone 17)
#   scripts/mobile/ios.sh stop    Simulator beenden
# Einmalig: Xcode aus dem App Store, sudo xcode-select -s /Applications/Xcode.app,
# sudo xcodebuild -license accept, xcodebuild -runFirstLaunch, xcodebuild -downloadPlatform iOS.
set -euo pipefail

DEVICE="${IOS_DEVICE:-iPhone 17}"

case "${1:-}" in
  start)
    xcrun simctl boot "$DEVICE" 2>/dev/null || true
    xcrun simctl bootstatus "$DEVICE" -b >/dev/null
    echo "iOS-Simulator bereit ($DEVICE); localhost des Macs ist direkt erreichbar"
    ;;
  stop)
    xcrun simctl shutdown "$DEVICE" 2>/dev/null || true
    ;;
  *)
    echo "Aufruf: $0 start|stop" >&2
    exit 1
    ;;
esac
