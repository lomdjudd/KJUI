#!/usr/bin/env bash
# Construit dist/spiderman-monde-ouvert.apk à partir de dist/index.html (lancer « npm run build » avant).
# Outils (Ubuntu/Debian) : sudo apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk
set -euo pipefail
cd "$(dirname "$0")"

ANDROID_JAR=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
VERSION_CODE=${VERSION_CODE:-2}
VERSION_NAME=${VERSION_NAME:-2.0}
OUT=../dist/spiderman-monde-ouvert.apk
B=build

rm -rf "$B"
mkdir -p "$B/assets/licenses" "$B/classes"

# Page du jeu (polices déjà intégrées : jouable hors ligne) et licences des polices
grep -q "fonts.googleapis" ../dist/index.html && { echo "dist/index.html charge encore des polices en ligne" >&2; exit 1; }
cp ../dist/index.html "$B/assets/index.html"
cp ../licenses/*.txt "$B/assets/licenses/"

# Code Java -> bytecode Java 8 -> dex
javac -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -Xlint:-options -encoding UTF-8 -d "$B/classes" src/fr/kjui/spiderman/*.java
dalvik-exchange --dex --min-sdk-version=24 --output="$B/classes.dex" "$B/classes"

# Manifeste + ressources + assets (resources.arsc non compressé, exigé par Android 11+)
aapt package -f -M AndroidManifest.xml -S res -A "$B/assets" -I "$ANDROID_JAR" -0 arsc \
  --min-sdk-version 24 --target-sdk-version 34 --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -F "$B/app-unaligned.apk"
(cd "$B" && aapt add app-unaligned.apk classes.dex >/dev/null)
zipalign -f -p 4 "$B/app-unaligned.apk" "$B/app-aligned.apk"

# Signature (clé de débogage publique du dépôt : sert seulement à pouvoir mettre à jour l'appli installée)
apksigner sign --ks debug.keystore --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android \
  --out "$OUT" "$B/app-aligned.apk"
apksigner verify "$OUT"
rm -rf "$B" "$OUT.idsig"
echo "APK prêt : dist/spiderman-monde-ouvert.apk"
