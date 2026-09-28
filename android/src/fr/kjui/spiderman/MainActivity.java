package fr.kjui.spiderman;

import android.app.Activity;
import android.content.ContentValues;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

// Le jeu (dist/index.html, copié dans les assets) tourne en plein écran dans une WebView.
public class MainActivity extends Activity {
    // Retour : ferme l'écran ouvert ou met le jeu en pause ; quitte seulement depuis l'écran titre
    private static final String BACK_JS = "(function(){var g=window.__game;return g&&g.handleBack?g.handleBack():'exit';})()";

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= 28) {
            // Occupe aussi la zone de l'encoche (champ absent de l'android.jar API 23 utilisé pour compiler)
            try {
                WindowManager.LayoutParams lp = w.getAttributes();
                lp.getClass().getField("layoutInDisplayCutoutMode").setInt(lp, 1);
                w.setAttributes(lp);
            } catch (Exception ignored) {
                // affichage classique sous l'encoche
            }
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // sauvegarde de la progression (localStorage)
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient()); // boîtes de dialogue confirm() du jeu
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        hideSystemUi();
        web.loadUrl("file:///android_asset/index.html");
    }

    private void hideSystemUi() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
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
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideSystemUi();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript(BACK_JS, new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String result) {
                if ("\"exit\"".equals(result)) MainActivity.super.onBackPressed();
            }
        });
    }

    // Appelée par le mode photo du jeu : enregistre l'image dans la galerie
    private class Bridge {
        @JavascriptInterface
        public void savePhoto(String dataUrl) {
            final boolean ok = savePng(dataUrl);
            final String text = !ok ? "Impossible d'enregistrer la photo"
                    : Build.VERSION.SDK_INT >= 29 ? "Photo enregistrée dans Images/Spider-Man" : "Photo enregistrée";
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(MainActivity.this, text, Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    private boolean savePng(String dataUrl) {
        try {
            byte[] png = Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT);
            String name = "spiderman-" + System.currentTimeMillis() + ".png";
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, "image/png");
                v.put("relative_path", Environment.DIRECTORY_PICTURES + "/Spider-Man");
                Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return false;
                OutputStream out = getContentResolver().openOutputStream(uri);
                try {
                    out.write(png);
                } finally {
                    out.close();
                }
            } else {
                File dir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
                if (dir == null) return false;
                dir.mkdirs();
                FileOutputStream out = new FileOutputStream(new File(dir, name));
                try {
                    out.write(png);
                } finally {
                    out.close();
                }
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
