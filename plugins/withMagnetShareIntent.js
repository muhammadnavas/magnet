const { withAndroidManifest, withMainActivity } = require("@expo/config-plugins");

const SHARE_SCHEME = "orio";

function withMagnetShareIntent(config) {
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (!app) return mod;
    app.activity = app.activity || [];
    const mainActivity = app.activity.find((activity) =>
      (activity.$?.["android:name"] || "").endsWith(".MainActivity")
    );
    if (!mainActivity) throw new Error("Magnet Share Intent: Could not find MainActivity in AndroidManifest.");

    mainActivity["intent-filter"] = mainActivity["intent-filter"] || [];
    const hasGeneralShareFilter = mainActivity["intent-filter"].some((filter) => {
      const actions = (filter.action || []).map((action) => action.$?.["android:name"]);
      const mimeTypes = (filter.data || []).map((data) => data.$?.["android:mimeType"]);
      return actions.includes("android.intent.action.SEND") &&
        actions.includes("android.intent.action.SEND_MULTIPLE") && mimeTypes.includes("*/*");
    });
    if (!hasGeneralShareFilter) {
      mainActivity["intent-filter"].push({
        action: [
          { $: { "android:name": "android.intent.action.SEND" } },
          { $: { "android:name": "android.intent.action.SEND_MULTIPLE" } },
        ],
        category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
        data: [{ $: { "android:mimeType": "*/*" } }],
      });
    }
    return mod;
  });

  config = withMainActivity(config, (mod) => {
    if (mod.modResults.language !== "kt") throw new Error("Magnet Share Intent currently supports Kotlin MainActivity only.");
    let source = mod.modResults.contents;
    if (source.includes("MAGNET_SHARE_INTENT_HANDLER")) return mod;
    if (!source.includes("override fun onCreate(savedInstanceState: Bundle?)")) {
      throw new Error("Magnet Share Intent: MainActivity onCreate signature was not recognized.");
    }

    const imports = [
      "import android.content.Intent",
      "import android.net.Uri",
      "import android.provider.OpenableColumns",
    ];
    for (const line of imports) {
      if (!source.includes(line)) {
        const packageMatch = source.match(/^package .*\n/m);
        if (packageMatch) source = source.replace(packageMatch[0], packageMatch[0] + "\n" + line + "\n");
      }
    }

    source = source.replace(
      "override fun onCreate(savedInstanceState: Bundle?) {",
      "override fun onCreate(savedInstanceState: Bundle?) {\n    // MAGNET_SHARE_INTENT_HANDLER\n    normalizeMagnetShareIntent(intent)"
    );

    const onNewIntentPattern = /override fun onNewIntent\(intent: Intent\)\s*\{[\s\S]*?\n\s*\}/;
    if (onNewIntentPattern.test(source)) {
      source = source.replace(onNewIntentPattern, (match) => match.replace("{", "{\n    normalizeMagnetShareIntent(intent)"));
    } else {
      const insertionPoint = source.indexOf("override fun createReactActivityDelegate()");
      if (insertionPoint === -1) throw new Error("Magnet Share Intent: Could not locate a safe insertion point in MainActivity.");
      source = source.slice(0, insertionPoint) +
        "override fun onNewIntent(intent: Intent) {\n    normalizeMagnetShareIntent(intent)\n    super.onNewIntent(intent)\n  }\n\n  " +
        source.slice(insertionPoint);
    }

    const method = `
  private fun normalizeMagnetShareIntent(incoming: Intent?) {
    if (incoming == null) return
    if (incoming.action != Intent.ACTION_SEND && incoming.action != Intent.ACTION_SEND_MULTIPLE) return

    val sharedText = incoming.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.trim().orEmpty()
    val sharedUris = mutableListOf<Uri>()
    val singleStream = if (android.os.Build.VERSION.SDK_INT >= 33) {
      incoming.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      @Suppress("DEPRECATION")
      incoming.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
    }
    if (singleStream != null) sharedUris.add(singleStream)

    if (incoming.action == Intent.ACTION_SEND_MULTIPLE) {
      val multipleStreams = if (android.os.Build.VERSION.SDK_INT >= 33) {
        incoming.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        @Suppress("DEPRECATION")
        incoming.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
      }
      multipleStreams?.forEach { if (!sharedUris.contains(it)) sharedUris.add(it) }
    }

    if (sharedText.isEmpty() && sharedUris.isEmpty()) return

    val mimeType = incoming.type ?: "text/plain"
    val builder = Uri.Builder().scheme("orio").authority("share")
    if (sharedText.isNotEmpty()) builder.appendQueryParameter("text", sharedText)
    builder.appendQueryParameter("mime", mimeType)

    sharedUris.forEach { uri ->
      builder.appendQueryParameter("stream", uri.toString())
      val displayName = try {
        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
          val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
          if (nameIndex >= 0 && cursor.moveToFirst()) cursor.getString(nameIndex) else null
        }
      } catch (_: Exception) { null }
      builder.appendQueryParameter("name", displayName?.takeIf { it.isNotBlank() } ?: uri.lastPathSegment ?: "Shared file")
      builder.appendQueryParameter("fileMime", contentResolver.getType(uri) ?: mimeType)
    }

    // Keep ClipData and URI grant flags so shared content:// files remain readable.
    incoming.action = Intent.ACTION_VIEW
    // Setting type after data would clear the deep-link URI.
    incoming.data = builder.build()
    incoming.removeExtra(Intent.EXTRA_TEXT)
    incoming.removeExtra(Intent.EXTRA_STREAM)
  }

`;
    const delegateIndex = source.indexOf("override fun createReactActivityDelegate()");
    source = source.slice(0, delegateIndex) + method + source.slice(delegateIndex);
    mod.modResults.contents = source;
    return mod;
  });
  return config;
}

module.exports = withMagnetShareIntent;
