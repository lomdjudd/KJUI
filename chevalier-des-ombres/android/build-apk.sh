#!/usr/bin/env bash
# Construit l'APK Android sans Android Studio ni Gradle :
#   aapt2 (ressources + manifeste + assets) → javac → d8 (dex) → apksigner (signature v1/v2/v3).
# Les outils (aapt2, android.jar API 34, d8, apksigner) sont récupérés depuis le registre npm
# au premier lancement et mis en cache dans android/.tools/.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$DIR")"
TOOLS="$DIR/.tools"
BUILD="$DIR/build"
OUT="$ROOT/release"
VERSION_CODE="${VERSION_CODE:-6}"
VERSION_NAME="${VERSION_NAME:-1.5}"
KS="$DIR/release.keystore"
KS_PASS="${KS_PASS:-chevalier}"
ALIAS="chevalier"

mkdir -p "$TOOLS" "$OUT"

fetch() {
  local pkg="$1"
  (cd "$TOOLS" && npm pack "$pkg" --silent >/dev/null && tar xzf ./*.tgz && rm -f ./*.tgz)
}

if [ ! -x "$TOOLS/aapt2" ]; then
  echo "→ Téléchargement d'aapt2…"
  fetch aaptjs3@2.0.2
  cp "$TOOLS/package/bin/x64/linux/aapt2" "$TOOLS/aapt2"
  chmod +x "$TOOLS/aapt2"
  rm -rf "$TOOLS/package"
fi
if [ ! -f "$TOOLS/android.jar" ] || [ ! -f "$TOOLS/d8.jar" ] || [ ! -f "$TOOLS/apksigner.jar" ]; then
  echo "→ Téléchargement d'android.jar, d8 et apksigner…"
  fetch @drxiaozhi/minapk@0.4.0
  cp "$TOOLS/package/tools/android.jar" "$TOOLS/package/tools/d8.jar" "$TOOLS/package/tools/apksigner.jar" "$TOOLS/"
  rm -rf "$TOOLS/package"
fi

if [ ! -f "$ROOT/dist/index.html" ]; then
  echo "→ Build du jeu (dist/index.html)…"
  (cd "$ROOT" && npm run build)
fi

rm -rf "$BUILD"
mkdir -p "$BUILD/assets" "$BUILD/classes" "$BUILD/dex"
cp "$ROOT/dist/index.html" "$BUILD/assets/index.html"
# Musiques et bruitages enregistrés (servis par la WebView sous https://appassets.androidplatform.net/)
if [ -d "$ROOT/dist/audio" ]; then cp -r "$ROOT/dist/audio" "$BUILD/assets/audio"; fi

echo "→ Ressources (aapt2)…"
"$TOOLS/aapt2" compile --dir "$DIR/res" -o "$BUILD/res.zip"
"$TOOLS/aapt2" link -o "$BUILD/base.apk" \
  -I "$TOOLS/android.jar" \
  --manifest "$DIR/AndroidManifest.xml" \
  -A "$BUILD/assets" \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  "$BUILD/res.zip"

echo "→ Compilation Java…"
javac -nowarn -Xlint:-options --release 8 -encoding UTF-8 -classpath "$TOOLS/android.jar" -d "$BUILD/classes" $(find "$DIR/java" -name '*.java')

echo "→ Dex (d8)…"
java -cp "$TOOLS/d8.jar" com.android.tools.r8.D8 --release --min-api 24 --lib "$TOOLS/android.jar" --output "$BUILD/dex" $(find "$BUILD/classes" -name '*.class')

cp "$BUILD/base.apk" "$BUILD/unsigned.apk"
(cd "$BUILD/dex" && zip -q -j "$BUILD/unsigned.apk" classes.dex)
python3 "$DIR/zipalign.py" "$BUILD/unsigned.apk" "$BUILD/aligned.apk"

if [ ! -f "$KS" ]; then
  echo "→ Création de la clé de signature…"
  keytool -genkeypair -keystore "$KS" -storetype PKCS12 -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=Chevalier des Ombres, O=KJUI, C=FR" >/dev/null 2>&1
fi

echo "→ Signature (apksigner)…"
APK="$OUT/ChevalierDesOmbres.apk"
java -jar "$TOOLS/apksigner.jar" sign --ks "$KS" --ks-key-alias "$ALIAS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --min-sdk-version 24 --out "$APK" "$BUILD/aligned.apk"
java -jar "$TOOLS/apksigner.jar" verify --min-sdk-version 24 "$APK"
rm -f "$APK.idsig"
echo "✔ APK prêt : $APK ($(du -h "$APK" | cut -f1))"
