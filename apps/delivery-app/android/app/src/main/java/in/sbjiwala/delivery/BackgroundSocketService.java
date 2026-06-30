package in.sbjiwala.delivery;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class BackgroundSocketService extends Service {
    private static final String CHANNEL_ID = "background_socket_channel";
    private static WebSocket webSocket;
    private static boolean isRunning = false;
    private String url;
    private String token;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("START".equals(action)) {
                url = intent.getStringExtra("url");
                token = intent.getStringExtra("token");
                if (url != null && token != null) {
                    startForegroundService();
                    connectWebSocket();
                }
            } else if ("STOP".equals(action)) {
                stopWebSocket();
                stopSelf();
            }
        }
        return START_STICKY;
    }

    private void startForegroundService() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Sbjiwala Delivery Realtime")
                .setContentText("Realtime connection is active in the background")
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .build();

        startForeground(1001, notification);
        isRunning = true;
    }

    private void connectWebSocket() {
        if (webSocket != null) {
            webSocket.close(1000, "Reconnecting");
        }

        OkHttpClient client = new OkHttpClient();
        Request request = new Request.Builder()
                .url(url + "?token=" + token)
                .build();

        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket ws, Response response) {
                NativeWebSocketPlugin plugin = NativeWebSocketPlugin.getInstance();
                if (plugin != null) {
                    plugin.onStateChange(true);
                }
            }

            @Override
            public void onMessage(WebSocket ws, String text) {
                NativeWebSocketPlugin plugin = NativeWebSocketPlugin.getInstance();
                if (plugin != null) {
                    plugin.onMessageReceived(text);
                }
            }

            @Override
            public void onClosing(WebSocket ws, int code, String reason) {
                ws.close(1000, null);
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, Response response) {
                if (isRunning) {
                    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                        if (isRunning) connectWebSocket();
                    }, 5000);
                }
                NativeWebSocketPlugin plugin = NativeWebSocketPlugin.getInstance();
                if (plugin != null) {
                    plugin.onStateChange(false);
                }
            }
        });
    }

    private void stopWebSocket() {
        isRunning = false;
        if (webSocket != null) {
            webSocket.close(1000, "Service stopped");
            webSocket = null;
        }
        NativeWebSocketPlugin plugin = NativeWebSocketPlugin.getInstance();
        if (plugin != null) {
            plugin.onStateChange(false);
        }
    }

    @Override
    public void onDestroy() {
        stopWebSocket();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Sbjiwala Background Channel",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }
}
