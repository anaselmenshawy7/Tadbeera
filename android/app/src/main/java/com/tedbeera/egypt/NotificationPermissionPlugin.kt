package com.tedbeera.egypt

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Explicit Android 13+ notification permission bridge.
 * Kept separate from LocalNotifications so permission prompting does not
 * depend on that plugin's permission alias/status implementation.
 */
@CapacitorPlugin(
    name = "NotificationPermission",
    permissions = [
        Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])
    ]
)
class NotificationPermissionPlugin : Plugin() {

    @PluginMethod
    fun consumeLaunchTarget(call: PluginCall) {
        val intent = activity.intent
        val target = intent.getStringExtra("tadbeera_target_tab")
        val meal = intent.getStringExtra("tadbeera_meal_type")
        intent.removeExtra("tadbeera_target_tab")
        intent.removeExtra("tadbeera_meal_type")
        call.resolve(JSObject().put("target", target).put("meal", meal))
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(
                Settings.EXTRA_APP_PACKAGE,
                context.packageName
            )
        } else {
            Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:${context.packageName}")
            )
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun checkExactAlarmPermission(call: PluginCall) {
        val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
        call.resolve(JSObject().put("granted", granted))
    }

    @PluginMethod
    fun openExactAlarmSettings(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
        ) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        try {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            call.resolve(JSObject().put("granted", false))
        } catch (error: Exception) {
            call.reject("تعذر فتح إعدادات المنبهات الدقيقة", error)
        }
    }

    @PluginMethod
    fun ensureAlarmChannel(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val manager = context.getSystemService(NotificationManager::class.java)
                val channelId = "tedbeera_alarm"
                val existing = manager.getNotificationChannel(channelId)
                if (existing != null && existing.audioAttributes?.usage != AudioAttributes.USAGE_ALARM) {
                    try {
                        manager.deleteNotificationChannel(channelId)
                    } catch (_: Exception) {
                        // Ignore if channel cannot be deleted while notifications are active
                    }
                }
                val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                val channel = NotificationChannel(
                    channelId,
                    "منبه تدبيرة القوي",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "منبه قوي بصوت المنبه الأساسي واهتزاز واضح حتى الإيقاف"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0L, 600L, 300L, 600L, 300L, 800L)
                    enableLights(true)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                    try {
                        setBypassDnd(true)
                    } catch (_: Exception) {
                    }
                    if (alarmUri != null) {
                        setSound(alarmUri, audioAttributes)
                    }
                }
                manager.createNotificationChannel(channel)
            } catch (error: Exception) {
                call.reject("تعذر تهيئة قناة المنبه القوي", error)
                return
            }
        }
        call.resolve(JSObject().put("created", true).put("channelId", "tedbeera_alarm"))
    }

    @PluginMethod
    fun sendTestNotification(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= 33 &&
            getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            call.resolve(JSObject().put("success", false).put("reason", "permission_denied"))
            return
        }
        try {
            val channelId = "tedbeera_meal_reminders"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val manager = context.getSystemService(NotificationManager::class.java)
                if (manager.getNotificationChannel(channelId) == null) {
                    manager.createNotificationChannel(
                        NotificationChannel(
                            channelId,
                            "تذكيرات وجبات تدبيرة",
                            NotificationManager.IMPORTANCE_HIGH
                        ).apply {
                            description = "تذكيرات الفطار والغداء والعشاء"
                        }
                    )
                }
            }
            if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
                call.resolve(JSObject().put("success", false).put("reason", "notifications_disabled"))
                return
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                context.getSystemService(NotificationManager::class.java)
                    .getNotificationChannel(channelId)?.importance == NotificationManager.IMPORTANCE_NONE
            ) {
                call.resolve(JSObject().put("success", false).put("reason", "channel_disabled"))
                return
            }
            val notification = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("تدبيرة جاهزة! 🔔")
                .setContentText("اختبار الإشعارات ناجح. هنفكّرك بمواعيد وجبات البيت.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .build()
            NotificationManagerCompat.from(context).notify(104, notification)
            call.resolve(JSObject().put("success", true))
        } catch (error: SecurityException) {
            call.resolve(JSObject().put("success", false).put("reason", "permission_denied"))
        } catch (error: Exception) {
            call.reject("تعذر إرسال إشعار الاختبار", error)
        }
    }

    @PluginMethod
    fun check(call: PluginCall) {
        resolveResult(call)
    }

    @PluginMethod
    fun request(call: PluginCall) {
        if (android.os.Build.VERSION.SDK_INT < 33 ||
            getPermissionState("notifications") == PermissionState.GRANTED
        ) {
            resolveResult(call)
            return
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionResult")
    }

    @PermissionCallback
    private fun notificationPermissionResult(call: PluginCall) {
        resolveResult(call)
    }

    private fun resolveResult(call: PluginCall) {
        val granted = android.os.Build.VERSION.SDK_INT < 33 ||
            getPermissionState("notifications") == PermissionState.GRANTED
        call.resolve(JSObject().put("granted", granted))
    }
}
