package in.sbjiwala.customer;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeWebSocket")
public class NativeWebSocketPlugin extends Plugin {
    private static NativeWebSocketPlugin instance;
    private static boolean isConnected = false;

    public static NativeWebSocketPlugin getInstance() {
        return instance;
    }

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String url = call.getString("url");
        String token = call.getString("token");

        if (url == null || token == null) {
            call.reject("URL and Token are required");
            return;
        }

        Intent serviceIntent = new Intent(getContext(), BackgroundSocketService.class);
        serviceIntent.setAction("START");
        serviceIntent.putExtra("url", url);
        serviceIntent.putExtra("token", token);
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }

        call.resolve();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), BackgroundSocketService.class);
        serviceIntent.setAction("STOP");
        getContext().startService(serviceIntent);
        call.resolve();
    }

    public void onStateChange(boolean connected) {
        isConnected = connected;
        JSObject ret = new JSObject();
        ret.put("connected", connected);
        notifyListeners("stateChange", ret);
    }

    public void onMessageReceived(String text) {
        JSObject ret = new JSObject();
        ret.put("data", text);
        notifyListeners("message", ret);
    }
}
