package com.kenostod.academy;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;
import android.content.Intent;

@CapacitorPlugin(name = "ICOPlugin")
public class ICOPlugin extends Plugin {

    @PluginMethod
    public void isAndroidApp(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isAndroid", true);
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
        String address = call.getString("address");
        
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("balance", "0");
        ret.put("address", address);
        ret.put("message", "This is a placeholder. Implement actual balance checking via API.");
        
        call.resolve(ret);
    }

    @PluginMethod
    public void shareICO(PluginCall call) {
        String message = call.getString("message", "Join the KENO ICO!");
        String url = call.getString("url", "https://kenostodblockchain.com");
        
        Intent shareIntent = new Intent(Intent.ACTION_SEND);
        shareIntent.setType("text/plain");
        shareIntent.putExtra(Intent.EXTRA_TEXT, message + "\n" + url);
        
        Intent chooser = Intent.createChooser(shareIntent, "Share KENO ICO");
        getBridge().getActivity().startActivity(chooser);
        
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkICOStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("phase", "presale");
        ret.put("pricePerToken", "0.01");
        ret.put("message", "Presale is active");
        
        call.resolve(ret);
    }
}
