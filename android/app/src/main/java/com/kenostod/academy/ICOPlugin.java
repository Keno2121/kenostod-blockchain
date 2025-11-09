package com.kenostod.academy;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ICOPlugin")
public class ICOPlugin extends Plugin {

    @PluginMethod
    public void isAndroidApp(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isAndroid", true);
        ret.put("appVersion", "1.0");
        ret.put("icoEnabled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void openICO(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("message", "Opening ICO presale page");
        call.resolve(ret);
        
        getBridge().getActivity().runOnUiThread(() -> {
            getBridge().getWebView().loadUrl("javascript:window.location.hash='#revenue';");
        });
    }

    @PluginMethod
    public void getKenoBalance(PluginCall call) {
        String walletAddress = call.getString("walletAddress");
        
        if (walletAddress == null || walletAddress.isEmpty()) {
            call.reject("Wallet address is required");
            return;
        }
        
        JSObject ret = new JSObject();
        ret.put("address", walletAddress);
        ret.put("balance", "0");
        ret.put("message", "Balance check requires Web3 connection");
        call.resolve(ret);
    }

    @PluginMethod
    public void shareICO(PluginCall call) {
        String message = call.getString("message", "Join the KENO Token ICO!");
        String url = call.getString("url", "https://kenostodblockchain.com");
        
        android.content.Intent shareIntent = new android.content.Intent(android.content.Intent.ACTION_SEND);
        shareIntent.setType("text/plain");
        shareIntent.putExtra(android.content.Intent.EXTRA_TEXT, message + " " + url);
        
        android.content.Intent chooser = android.content.Intent.createChooser(shareIntent, "Share KENO ICO");
        getBridge().getActivity().startActivity(chooser);
        
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkICOStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("icoActive", true);
        ret.put("phase", "public_sale");
        ret.put("appReady", true);
        call.resolve(ret);
    }
}
