import axios from "axios";
import { normalizeCredentials, getErrorMessage } from "../../utils/helpers.js";
import { geotabLimiter } from "../../utils/geotabLimiter.js";

const geotabSessionCache = new Map();
const GEOTAB_SESSION_TTL = 20 * 60 * 1000;

export async function authenticateGeotab(credentials) {
  const normalized = normalizeCredentials(credentials);

  if (!normalized) {
    throw new Error(
      "Missing valid Geotab database, username, or password."
    );
  }

  const cacheKey = `${normalized.database}:${normalized.username}`;
  const cached = geotabSessionCache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < GEOTAB_SESSION_TTL) {
    return cached;
  }

  console.log(`[Geotab Auth] Authenticating database: ${normalized.database}`);

  const response = await axios.post(
    "https://my.geotab.com/apiv1",
    {
      method: "Authenticate",
      params: {
        database: normalized.database,
        userName: normalized.username,
        password: normalized.password
      }
    },
    { timeout: 30000 }
  );

  if (response.data?.error) {
    throw new Error(
      response.data.error.message || "Geotab authentication failed."
    );
  }

  const result = response.data?.result;

  if (!result?.credentials?.sessionId || !result?.path) {
    throw new Error("Geotab returned an invalid authentication response.");
  }

  const serverUri =
    result.path === "ThisServer"
      ? "https://my.geotab.com"
      : `https://${result.path}`;

  const session = {
    database: normalized.database,
    username: normalized.username,
    sessionId: result.credentials.sessionId,
    serverUri,
    createdAt: Date.now()
  };

  geotabSessionCache.set(cacheKey, session);
  console.log(`[Geotab Auth] Authentication successful: ${normalized.database}`);

  return session;
}

export async function callGeotabApi(
  organizationId,
  credentials,
  requestBody,
  retry = true
) {
  const normalized = normalizeCredentials(credentials);

  if (!normalized) {
    throw new Error(
      `[Geotab] Invalid credentials for organization ${organizationId}`
    );
  }

  let session = await authenticateGeotab(normalized);

  try {
    const apiCallFunction = async (orgId, creds, reqBody) => {
      const response = await axios.post(
        `${session.serverUri}/apiv1`,
        {
          method: reqBody.method,
          params: {
            credentials: {
              database: session.database,
              userName: session.username,
              sessionId: session.sessionId
            },
            ...(reqBody.params || {})
          }
        },
        { timeout: 60000 }
      );

      if (response.data?.error) {
        throw new Error(
          response.data.error.message || "Unknown Geotab API error."
        );
      }

      return response.data?.result ?? [];
    };

    return await geotabLimiter.execute(organizationId, normalized, requestBody, apiCallFunction, 3);

  } catch (error) {
    const message = getErrorMessage(error);

    if (
      retry &&
      (
        message.toLowerCase().includes("session") ||
        message.toLowerCase().includes("authentication") ||
        message.toLowerCase().includes("credential")
      )
    ) {
      const cacheKey = `${normalized.database}:${normalized.username}`;
      geotabSessionCache.delete(cacheKey);
      console.log("[Geotab API] Session invalid. Re-authenticating.");

      return callGeotabApi(
        organizationId,
        normalized,
        requestBody,
        false
      );
    }

    throw error;
  }
}
