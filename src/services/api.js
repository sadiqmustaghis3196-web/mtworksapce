export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response
    .json()
    .catch(() => ({ message: "The server returned an unexpected response." }));
  if (!response.ok) {
    const error = new Error(
      data.message ||
        data.details?.map((d) => d.message).join(", ") ||
        "Request failed.",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
