// Formatting utility functions
export const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const truncateString = (str, num) => {
  if (str.length <= num) {
    return str;
  }
  return str.slice(0, num) + "...";
};

const REDUNDANT_TAGS = new Set([
  "imported", "pdf", "file", "doc", "text", "document", "url",
  "github", "image", "unknown", "screenshot", "code", "error"
]);

export const filterMeaningfulTags = (rawTags, contentType = "") => {
  if (!Array.isArray(rawTags)) return [];
  const typeLower = (contentType || "").trim().toLowerCase();
  
  return rawTags
    .map((t) => (typeof t === "string" ? t : (t && t.name ? t.name : "")))
    .filter((t) => {
      if (!t) return false;
      const lower = t.trim().toLowerCase();
      if (REDUNDANT_TAGS.has(lower)) return false;
      if (typeLower && lower === typeLower) return false;
      return true;
    });
};

export const formatDate = (dateString) => {
  try {
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  } catch (e) {
    return dateString;
  }
};

export default { formatBytes, truncateString, formatDate, filterMeaningfulTags };
