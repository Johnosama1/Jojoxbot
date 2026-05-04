// Vercel serverless function — CommonJS wrapper for the Express app
// Uses dynamic import() to load the ESM module built from vercel-entry.ts

let _app = null;

module.exports = async function handler(req, res) {
  if (!_app) {
    const mod = await import("../artifacts/api-server/dist/vercel-entry.mjs");
    _app = mod.default;
  }
  return _app(req, res);
};
