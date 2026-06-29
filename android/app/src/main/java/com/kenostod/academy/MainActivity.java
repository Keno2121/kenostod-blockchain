package com.kenostod.academy;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private String pendingDeepLinkHash = null;
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        registerPlugin(ICOPlugin.class);
        
        handleDeepLink(getIntent());
    }
    
    @Override
    public void onResume() {
        super.onResume();
        
        if (pendingDeepLinkHash != null) {
            final String hash = pendingDeepLinkHash;
            pendingDeepLinkHash = null;
            
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                navigateToHash(hash);
            }, 1500);
        }
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }
    
    private void handleDeepLink(Intent intent) {
        String action = intent.getAction();
        Uri data = intent.getData();
        
        if (Intent.ACTION_VIEW.equals(action) && data != null) {
            String scheme = data.getScheme();
            String host = data.getHost();
            
            if ("keno".equals(scheme)) {
                String targetHash = null;
                
                if ("ico".equals(host)) {
                    targetHash = "#revenue";
                } else if ("wallet".equals(host)) {
                    targetHash = "#wallet";
                }
                
                if (targetHash != null) {
                    final String finalTargetHash = targetHash;
                    if (bridge != null && bridge.getWebView() != null && bridge.getWebView().getUrl() != null) {
                        new Handler(Looper.getMainLooper()).postDelayed(() -> {
                            navigateToHash(finalTargetHash);
                        }, 500);
                    } else {
                        pendingDeepLinkHash = targetHash;
                    }
                }
            }
        }
    }
    
    private void navigateToHash(String hash) {
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().evaluateJavascript(
                "window.location.hash = '" + hash + "';", 
                null
            );
        }
    }
}
