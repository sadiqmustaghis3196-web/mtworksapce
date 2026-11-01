// Vercel's Node function uses the existing Express app; it must not call listen().
import app from "../server/src/app.js";

export default app;
