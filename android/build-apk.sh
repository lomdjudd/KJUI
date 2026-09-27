#!/usr/bin/env bash
# Construit dist/spiderman-monde-ouvert.apk à partir de dist/index.html (lancer « npm run build » avant).
# Outils (Ubuntu/Debian) : sudo apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk
set -euo pipefail
cd "$(dirname "$0")"

ANDROID_JAR=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
VERSION_CODE=${VERSION_CODE:-1}
VERSION_NAME=${VERSION_NAME:-1.0}
OUT=../dist/spiderman-monde-ouvert.apk
B=build

rm -rf "$B"
mkdir -p "$B/assets/fonts" "$B/classes"

# Page du jeu avec les polices embarquées à la place de Google Fonts : jouable hors ligne
cp fonts/*.woff2 fonts/OFL-*.txt "$B/assets/fonts/"
node -e '
const fs = require("fs");
let html = fs.readFileSync("../dist/index.html", "utf8");
const face = (family, weight, file) => `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(fonts/${file}) format("woff2")}`;
const css = `<style>${face("Bangers", 400, "bangers-400.woff2")}${face("Barlow Condensed", 500, "barlow-condensed-500.woff2")}${face("Barlow Condensed", 700, "barlow-condensed-700.woff2")}</style>`;
const links = /<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g;
if (!links.test(html)) throw new Error("liens Google Fonts introuvables dans dist/index.html");
html = html.replace(links, "").replace("</head>", `${css}\n</head>`);
fs.writeFileSync(process.argv[1], html);
' "$B/assets/index.html"

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
