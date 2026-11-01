function validateCsrf({ method, origin, fetchSite, requestedWith }, allowed) {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  return (
    fetchSite !== "cross-site" &&
    (!origin || allowed.includes(origin)) &&
    requestedWith === "XMLHttpRequest"
  );
}
module.exports = { validateCsrf };
