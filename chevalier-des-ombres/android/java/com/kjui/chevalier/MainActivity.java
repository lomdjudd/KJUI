package com.kjui.chevalier;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Chevalier des Ombres : le jeu (HTML5 / WebGL) tourne dans une WebView plein écran.
 * Un pont JavaScript fournit une sauvegarde native (SharedPreferences), les vibrations,
 * les informations sur l'appareil et la sortie de l'application.
 */
public class MainActivity extends Activity {
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
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(this), "AndroidBridge");
        setContentView(web);
        hideSystemUi();
        web.loadUrl("file:///android_asset/index.html");
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
