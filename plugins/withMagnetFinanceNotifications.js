const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SERVICE = "com.muhammadnavas.orio.finance.MagnetNotificationListener";

function withMagnetFinanceNotifications(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    for (const permission of ["android.permission.INTERNET", "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"]) {
      if (!manifest["uses-permission"].some((item) => item.$?.["android:name"] === permission)) {
        manifest["uses-permission"].push({ $: { "android:name": permission } });
      }
    }
    const app = manifest.application?.[0];
    if (app) {
      app.service = app.service || [];
      if (!app.service.some((item) => item.$?.["android:name"] === SERVICE)) {
        app.service.push({
          $: { "android:name": SERVICE, "android:label": "Magnet Finance Capture", "android:permission": "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE", "android:exported": "true" },
          "intent-filter": [{ action: [{ $: { "android:name": "android.service.notification.NotificationListenerService" } }] }],
          "meta-data": [{ $: { "android:name": "android.service.notification.NotificationListenerService", "android:resource": "@xml/magnet_notification_listener" } }],
        });
      }
      app["meta-data"] = app["meta-data"] || [];
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || config.extra?.magnetApiUrl || "";
      const existing = app["meta-data"].find((item) => item.$?.["android:name"] === "com.muhammadnavas.orio.FINANCE_API_URL");
      if (existing) existing.$["android:value"] = apiUrl;
      else app["meta-data"].push({ $: { "android:name": "com.muhammadnavas.orio.FINANCE_API_URL", "android:value": apiUrl } });
    }
    return mod;
  });

  config = withDangerousMod(config, ["android", async (mod) => {
    const root = mod.modRequest.platformProjectRoot;
    const javaDir = path.join(root, "app/src/main/java/com/muhammadnavas/orio/finance");
    const xmlDir = path.join(root, "app/src/main/res/xml");
    fs.mkdirSync(javaDir, { recursive: true });
    fs.mkdirSync(xmlDir, { recursive: true });
    fs.writeFileSync(path.join(xmlDir, "magnet_notification_listener.xml"), `<notification-listener-service xmlns:android="http://schemas.android.com/apk/res/android" android:description="@string/app_name" android:notificationTimeout="500" />`);
    fs.writeFileSync(path.join(javaDir, "MagnetNotificationListener.kt"), `package com.muhammadnavas.orio.finance

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.content.pm.PackageManager
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class MagnetNotificationListener : NotificationListenerService() {
  private val executor = Executors.newSingleThreadExecutor()
  private val paymentPackages = setOf(
    "com.google.android.apps.nbu.paisa.user", "com.phonepe.app",
    "net.one97.paytm", "in.org.npci.upiapp", "com.amazon.mShop.android.shopping",
    "com.sbi.SBIFreedomPlus", "com.sbi.lotusintouch", "com.axis.mobile",
    "com.icicibank.imobile", "com.hdfcbank.android", "com.csam.icici.bank.imobile",
    "com.kotak811.app", "com.dreamplug.androidapp", "com.mobikwik_new"
  )
  private val cues = Regex("(?i)\\b(paid|payment|debited|debit|sent|transferred|received|credited|credit|spent|purchase|transaction)\\b")
  private val amount = Regex("(?i)(₹|INR|Rs\\.?\\s*)\\s?[0-9][0-9,]*(\\.[0-9]{1,2})?|\\b(amount|for)\\s*(₹|INR|Rs\\.?\\s*)?[0-9][0-9,]*(\\.[0-9]{1,2})?")

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName == packageName || sbn.packageName !in paymentPackages) return
    val extras = sbn.notification.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.take(300).orEmpty()
    val text = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
      ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    if (text.isBlank() || !cues.containsMatchIn("$title $text") || !amount.containsMatchIn("$title $text")) return
    executor.execute { sendNotification(sbn.packageName, title, text, sbn.postTime) }
  }

  private fun sendNotification(pkg: String, title: String, text: String, postedAt: Long) {
    try {
      val info = packageManager.getApplicationInfo(pkg, 0)
      val appName = packageManager.getApplicationLabel(info).toString()
      val metadata = packageManager.getApplicationInfo(packageName, PackageManager.GET_META_DATA).metaData
      val apiRoot = metadata?.getString("com.muhammadnavas.orio.FINANCE_API_URL").orEmpty().trimEnd('/')
      if (apiRoot.isBlank()) return
      val endpoint = if (apiRoot.endsWith("/api/v1")) "$apiRoot/finance/ingest-notification" else "$apiRoot/api/v1/finance/ingest-notification"
      val body = JSONObject().put("package_name", pkg).put("app_name", appName)
        .put("title", title).put("text", text).put("posted_at", postedAt).toString()
      val connection = (URL(endpoint).openConnection() as HttpURLConnection)
      connection.requestMethod = "POST"
      connection.connectTimeout = 8000
      connection.readTimeout = 8000
      connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
      connection.inputStream.close()
      connection.disconnect()
    } catch (error: Exception) {
      Log.w("MagnetFinance", "Could not submit a parsed payment notification", error)
    }
  }

  override fun onDestroy() {
    executor.shutdown()
    super.onDestroy()
  }
}
`);
    return mod;
  }]);
  return config;
}
module.exports = withMagnetFinanceNotifications;
