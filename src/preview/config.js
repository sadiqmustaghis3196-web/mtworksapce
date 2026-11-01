export const isPreview = import.meta.env.VITE_UI_PREVIEW === "true";
// Public UI-preview credentials only. Never used by the real Express backend.
export const previewCredentials = isPreview
  ? { email: "admin@mtnexus.test", password: "NexusUI@2026!" }
  : null;
