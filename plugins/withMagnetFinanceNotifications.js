const { withAndroidManifest, withDangerousMod, withMainApplication } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");
const SERVICE = "com.muhammadnavas.orio.finance.MagnetNotificationListener";

function withMagnetFinanceNotifications(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    for (const permission of ["android.permission.INTERNET"]) {
      if (!manifest["uses-permission"].some((item) => item.$?.["android:name"] === permission)) manifest["uses-permission"].push({ $: { "android:name": permission } });
    }
    const app = manifest.application?.[0];
    if (app) {
      app.service = app.service || [];
      if (!app.service.some((item) => item.$?.["android:name"] === SERVICE)) {
        app.service.push({
          $: { "android:name": SERVICE, "android:label": "Magnet Finance Capture", "android:permission": "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE", "android:exported": "true" },
          "intent-filter": [{ action: [{ $: { "android:name": "android.service.notification.NotificationListenerService" } }] }],
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

  config = withMainApplication(config, (mod) => {
    if (mod.modResults.language !== "kt") throw new Error("Magnet Finance requires Kotlin MainApplication.");
    let source = mod.modResults.contents;
    if (!source.includes("MagnetFinancePackage()")) {
      const importLine = "import com.muhammadnavas.orio.finance.MagnetFinancePackage";
      if (!source.includes(importLine)) source = source.replace(/^(package .*\n)/m, "$1\n" + importLine + "\n");
      const marker = "PackageList(this).packages.apply {";
      if (!source.includes(marker)) throw new Error("Magnet Finance could not find PackageList(this).packages.apply in MainApplication.");
      source = source.replace(marker, marker + "\n          add(MagnetFinancePackage())");
    }
    mod.modResults.contents = source;
    return mod;
  });

  config = withDangerousMod(config, ["android", async (mod) => {
    const root = mod.modRequest.platformProjectRoot;
    const dir = path.join(root, "app/src/main/java/com/muhammadnavas/orio/finance");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "MagnetNotificationListener.kt"), `package com.muhammadnavas.orio.finance

import android.app.Notification
import android.content.pm.PackageManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MagnetNotificationListener : NotificationListenerService() {
  private val executor = Executors.newSingleThreadExecutor()
  private val paymentPackages = setOf(
    "com.google.android.apps.nbu.paisa.user", "com.phonepe.app", "net.one97.paytm",
    "in.org.npci.upiapp", "com.sbi.SBIFreedomPlus", "com.axis.mobile",
    "com.icicibank.imobile", "com.hdfcbank.android", "com.kotak811.app",
    "com.dreamplug.androidapp", "com.mobikwik_new"
  )
  private val cues = Regex("(?i)\\\\b(paid|payment|debited|debit|sent|transferred|received|credited|credit|spent|purchase|transaction)\\\\b")
  private val amount = Regex("(?i)(₹|INR|Rs\\\\.?\\\\s*)\\\\s?[0-9][0-9,]*(\\\\.[0-9]{1,2})?|\\\\b(amount|for)\\\\s*(₹|INR|Rs\\\\.?\\\\s*)?[0-9][0-9,]*(\\\\.[0-9]{1,2})?")
  private val sensitive = Regex("(?i)\\\\b(otp|one[- ]time password|verification code|security code|login code|passcode|cvv|upi pin)\\\\b")

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName == packageName || sbn.packageName !in paymentPackages || sbn.isOngoing) return
    val extras = sbn.notification.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.take(300).orEmpty()
    val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
      ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()).take(2000)
    val message = "$title $text"
    if (text.isBlank() || !cues.containsMatchIn(message) || !amount.containsMatchIn(message) || sensitive.containsMatchIn(message)) return
    // Forward only a likely payment notification from an explicitly supported app.
    // Never log or persist the raw notification text on-device.
    executor.execute { sendNotification(sbn.packageName, title, text, sbn.postTime) }
  }

  private fun sendNotification(pkg: String, title: String, text: String, postedAt: Long) {
    try {
      val info = packageManager.getApplicationInfo(pkg, 0)
      val appName = packageManager.getApplicationLabel(info).toString()
      val metadata = packageManager.getApplicationInfo(packageName, PackageManager.GET_META_DATA).metaData
      val apiRoot = metadata?.getString("com.muhammadnavas.orio.FINANCE_API_URL").orEmpty().trimEnd('/')
      if (apiRoot.isBlank()) { Log.w("MagnetFinance", "EXPO_PUBLIC_API_URL was empty at native build time"); return }
      if (!apiRoot.startsWith("https://") && !apiRoot.startsWith("http://10.0.2.2") && !apiRoot.startsWith("http://127.0.0.1") && !apiRoot.startsWith("http://localhost")) { Log.e("MagnetFinance", "Refusing insecure finance API URL"); return }
      val endpoint = if (apiRoot.endsWith("/api/v1")) "$apiRoot/finance/ingest-notification" else "$apiRoot/api/v1/finance/ingest-notification"
      val body = JSONObject().put("package_name", pkg).put("app_name", appName).put("title", title).put("text", text).put("posted_at", postedAt).toString()
      val connection = URL(endpoint).openConnection() as HttpURLConnection
      connection.requestMethod = "POST"
      connection.connectTimeout = 8000
      connection.readTimeout = 8000
      connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      try {
        connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        val code = connection.responseCode
        if (code !in 200..299) Log.w("MagnetFinance", "Finance API returned HTTP $code")
        (if (code in 200..299) connection.inputStream else connection.errorStream)?.close()
      } finally {
        connection.disconnect()
      }
    } catch (error: Exception) { Log.w("MagnetFinance", "Could not submit payment alert", error) }
  }

  override fun onDestroy() { executor.shutdown(); super.onDestroy() }
}
`);
    fs.writeFileSync(path.join(dir, "MagnetFinanceModule.kt"), `package com.muhammadnavas.orio.finance

import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class MagnetFinanceModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "MagnetFinance"

  @ReactMethod
  fun isNotificationAccessEnabled(promise: Promise) {
    try {
      val enabled = Settings.Secure.getString(reactApplicationContext.contentResolver, "enabled_notification_listeners")
      val component = "\${reactApplicationContext.packageName}/\${MagnetNotificationListener::class.java.name}"
      promise.resolve(!TextUtils.isEmpty(enabled) && enabled.contains(component))
    } catch (error: Exception) { promise.reject("PERMISSION_CHECK_FAILED", error) }
  }

  @ReactMethod
  fun openNotificationAccessSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) { promise.reject("SETTINGS_OPEN_FAILED", error) }
  }
}
`);
    fs.writeFileSync(path.join(dir, "MagnetFinancePackage.kt"), `package com.muhammadnavas.orio.finance

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class MagnetFinancePackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(MagnetFinanceModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
`);
    return mod;
  }]);
  return config;
}
module.exports = withMagnetFinanceNotifications;
