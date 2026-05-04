// Vercel serverless function — proxies all requests to the Express app
// Built from artifacts/api-server/src/vercel-entry.ts
import handler from "../artifacts/api-server/dist/vercel-entry.mjs";
export default handler;
