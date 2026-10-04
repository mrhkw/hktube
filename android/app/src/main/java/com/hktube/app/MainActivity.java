package com.hktube.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.net.URISyntaxException;

public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER = 4101;
    private static final String TRUSTED_HOST = "hktube.vercel.app";
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("intent".equalsIgnoreCase(uri.getScheme())) return openTrustedChromeIntent(uri);
                return false;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER);
                    return true;
                } catch (Exception error) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        String deepLink = trustedHkTubeLink(getIntent().getData());
        String startUrl = deepLink != null ? deepLink : "https://hktube.vercel.app/?app=android";
        webView.loadUrl(startUrl);
    }

    private static String trustedHkTubeLink(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())
                || !TRUSTED_HOST.equalsIgnoreCase(uri.getHost())
                || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) return null;
        return uri.toString();
    }

    private boolean openTrustedChromeIntent(Uri intentUri) {
        try {
            Intent intent = Intent.parseUri(intentUri.toString(), Intent.URI_INTENT_SCHEME);
            Uri destination = intent.getData();
            if (!"com.android.chrome".equals(intent.getPackage()) || trustedHkTubeLink(destination) == null) return true;
            try {
                startActivity(intent);
            } catch (ActivityNotFoundException noChrome) {
                // A trusted URL may fall back to the device's browser; never forward an arbitrary intent.
                startActivity(new Intent(Intent.ACTION_VIEW, destination));
            }
        } catch (URISyntaxException | ActivityNotFoundException ignored) {
            // Consume malformed or unavailable intents instead of letting WebView navigate them.
        }
        return true;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String deepLink = trustedHkTubeLink(intent.getData());
        if (deepLink != null && webView != null) webView.loadUrl(deepLink);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER || fileCallback == null) return;
        Uri[] result = resultCode == RESULT_OK && data != null ? new Uri[]{data.getData()} : null;
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        webView.destroy();
        super.onDestroy();
    }
}
