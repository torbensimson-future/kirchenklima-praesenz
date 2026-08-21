# Kirchenklima Präsenz

Mobile Companion-App für den **Präsenz-Bereich** von Kirchenklima (Eingangszähler + LD2450-Radar).

## Features

- Live-Belegung (Personen im Raum)
- Heute rein / raus
- Manuelle Korrektur (+1 / −1 / Reset)
- Gruppen-Besuche
- LD2450-Radar-Karte mit Zielen
- Dark, Apple-inspiriertes UI
- Verbindung zum Pi per LAN oder Tailscale

## Schnellstart (Web)

Öffne `www/index.html` im Browser (oder hoste den Ordner) und trage die Kirchenklima-URL ein.

## Android APK bauen

Voraussetzungen: JDK 17+, Android SDK 34, Gradle 8.5+

```bash
cd android
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

## API (Kirchenklima)

- `GET /api/door/status`
- `POST /api/door/adjust` `{ "delta": 1 }`
- `POST /api/door/reset` `{ "value": 0 }`
- `GET /api/door/groups`
- `GET /api/radar/status`

## Package

- App-ID: `de.kirchenklima.praesenz`
- Version: 1.0.0

## Lizenz

Privat / Kirchenintern – Nutzung im Rahmen der Kirchenklima-Installation.
