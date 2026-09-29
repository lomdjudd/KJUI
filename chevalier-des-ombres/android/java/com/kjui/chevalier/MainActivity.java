package com.kjui.chevalier;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Chevalier des Ombres : le jeu (HTML5 / WebGL) tourne dans une WebView plein écran.
 * Un pont JavaScript fournit une sauvegarde native (SharedPreferences), les vibrations,
 * les informations sur l'appareil et la sortie de l'application.
 */
public class MainActivity extends Activity {
    // Les fichiers du jeu (page, musiques, bruitages) sont servis depuis les assets de l'APK
    // sous une adresse https interne : le jeu peut ainsi charger ses fichiers audio.
    private static final String HOST = "appassets.androidplatform.net";
    private static final String BASE = "https://" + HOST + "/";
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(5, 3, 8));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new AssetClient(this));
        web.addJavascriptInterface(new Bridge(this), "AndroidBridge");
        setContentView(web);
        hideSystemUi();
        web.loadUrl(BASE + "index.html");
    }

    // Sert les fichiers des assets sous https://appassets.androidplatform.net/ (page, musiques, bruitages)
    private static final class AssetClient extends WebViewClient {
        private final Activity act;

        AssetClient(Activity act) {
            this.act = act;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (!HOST.equals(u.getHost())) return null;
            String path = u.getPath();
            if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
            try {
                InputStream in = act.getAssets().open(path.substring(1));
                String mime = mimeOf(path);
                WebResourceResponse r = new WebResourceResponse(mime, mime.startsWith("text/") ? "utf-8" : null, in);
                Map<String, String> h = new HashMap<String, String>();
                h.put("Access-Control-Allow-Origin", "*");
                h.put("Cache-Control", "no-cache");
                r.setResponseHeaders(h);
                return r;
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), null);
            }
        }
    }

    private static String mimeOf(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".webm")) return "audio/webm";
        if (p.endsWith(".ogg")) return "audio/ogg";
        if (p.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // Le bouton retour ouvre la pause / revient en arrière dans les menus du jeu
        if (web != null) web.evaluateJavascript("window.__androidBack && window.__androidBack()", null);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) {
            web.onPause();
            web.pauseTimers();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.resumeTimers();
            web.onResume();
        }
        hideSystemUi();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** Ferme l'application depuis le fil principal. */
    static class Finisher implements Runnable {
        private final Activity activity;

        Finisher(Activity activity) {
            this.activity = activity;
        }

        @Override
        public void run() {
            activity.finishAndRemoveTask();
        }
    }

    /** Pont exposé au JavaScript sous le nom window.AndroidBridge. */
    static class Bridge {
        private final Activity activity;
        private final SharedPreferences prefs;

        Bridge(Activity activity) {
            this.activity = activity;
            this.prefs = activity.getSharedPreferences("chevalier_saves", Context.MODE_PRIVATE);
        }

        @JavascriptInterface
        public String getItem(String key) {
            return prefs.getString(key, null);
        }

        @JavascriptInterface
        public void setItem(String key, String value) {
            prefs.edit().putString(key, value).apply();
        }

        @JavascriptInterface
        public void removeItem(String key) {
            prefs.edit().remove(key).apply();
        }

        @JavascriptInterface
        @SuppressWarnings("deprecation")
        public void vibrate(int ms) {
            Vibrator v = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(Math.max(1, ms), VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(ms);
        }

        @JavascriptInterface
        public void exitApp() {
            activity.runOnUiThread(new Finisher(activity));
        }

        @JavascriptInterface
        public String deviceInfo() {
            ActivityManager am = (ActivityManager) activity.getSystemService(Context.ACTIVITY_SERVICE);
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            if (am != null) am.getMemoryInfo(mi);
            double ramGb = mi.totalMem / (1024.0 * 1024.0 * 1024.0);
            int cores = Runtime.getRuntime().availableProcessors();
            String model = (Build.MANUFACTURER + " " + Build.MODEL).replace("\"", "'");
            return "{\"ramGb\":" + String.format(java.util.Locale.US, "%.2f", ramGb) + ",\"cores\":" + cores
                    + ",\"sdk\":" + Build.VERSION.SDK_INT + ",\"model\":\"" + model + "\"}";
        }
    }
}
