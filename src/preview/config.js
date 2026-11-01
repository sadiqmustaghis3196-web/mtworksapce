// UI design is the current default, including Vercel builds using plain vite build.
// Real backend mode must be selected explicitly with build:production.
export const isPreview = import.meta.env.VITE_UI_PREVIEW !== "false";
// Public UI-preview credentials only. Never used by the real Express backend.
export const previewCredentials = isPreview
  ? { email: "admin@mtnexus.test", password: "NexusUI@2026!" }
  : null;
