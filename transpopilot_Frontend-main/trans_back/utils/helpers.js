import crypto from "crypto";

export function createStats() {
  return {
    fetched: 0,
    mapped: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };
}

export function addError(stats, error) {
  stats.failed += 1;

  const message =
    error instanceof Error
      ? error.message
      : String(error);

  stats.errors.push(message);

  console.error(message);
}

export function chunkArray(array, size = 500) {
  const chunks = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

export function getErrorMessage(error) {
  if (error?.response?.data?.error?.message) {
    return error.response.data.error.message;
  }

  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.message) {
    return error.message;
  }

  return String(error);
}

export function stableId(value) {
  if (value === undefined || value === null) return null;

  return String(value);
}

export function createFallbackProviderId(prefix, object) {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(object))
    .digest("hex");

  return `${prefix}_${hash}`;
}

export function getDateRange(days = 30) {
  const to = new Date();
  const from = new Date(to);

  from.setDate(from.getDate() - Number(days));

  return {
    from,
    to
  };
}

export function normalizeCredentials(credentials) {
  if (!credentials) return null;

  const username =
    credentials.username ||
    credentials.userName ||
    credentials.email;

  const password = credentials.password;
  const database = credentials.database || credentials.databaseName;
  const server = credentials.server || credentials.serverName || "my.geotab.com";

  if (!username || !password || !database) {
    return null;
  }

  return {
    username,
    password,
    database,
    server
  };
}

export function parseTimeSpanToSeconds(ts) {
  if (!ts) return 0;
  
  const match = ts.match(/(?:(\d+)\.)?(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  
  if (!match) return 0;

  const days = parseInt(match[1] || "0", 10);
  const hours = parseInt(match[2] || "0", 10);
  const minutes = parseInt(match[3] || "0", 10);
  const seconds = parseInt(match[4] || "0", 10);
  
  return (days * 86400) + (hours * 3600) + (minutes * 60) + seconds;
}
