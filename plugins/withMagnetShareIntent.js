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
    const hasShareFilter = mainActivity["intent-filter"].some((filter) =>
      (filter.action || []).some((action) => action.$?.["android:name"] === "android.intent.action.SEND")
    );
    if (!hasShareFilter) {
      mainActivity["intent-filter"].push({
        action: [{ $: { "android:name": "android.intent.action.SEND" } }],
        category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
        data: [{ $: { "android:mimeType": "text/plain" } }],
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

    if (!source.includes("import android.content.Intent")) {
      source = source.replace(/^(package .*\n)/m, "$1\nimport android.content.Intent\nimport android.net.Uri\n");
    } else if (!source.includes("import android.net.Uri")) {
      source = source.replace("import android.content.Intent", "import android.content.Intent\nimport android.net.Uri");
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
    if (incoming?.action != Intent.ACTION_SEND) return
    val sharedText = incoming.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.trim()
    if (sharedText.isNullOrEmpty()) return
    incoming.action = Intent.ACTION_VIEW
    incoming.data = Uri.parse("${SHARE_SCHEME}://share?text=" + Uri.encode(sharedText))
    incoming.removeExtra(Intent.EXTRA_TEXT)
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
