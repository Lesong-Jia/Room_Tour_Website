export function normalizeTaskResponseCondition(condition) {
  return String(condition || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}
