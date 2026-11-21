const fs = require("fs");
const path = require("path");
const config = require("./app.json");

const localGoogleServices = path.join(__dirname, "google-services.json");
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ||
  (fs.existsSync(localGoogleServices) ? "./google-services.json" : undefined);

if (googleServicesFile) {
  config.expo.android.googleServicesFile = googleServicesFile;
} else {
  delete config.expo.android.googleServicesFile;
}

module.exports = config;
