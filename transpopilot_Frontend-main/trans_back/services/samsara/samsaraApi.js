import axios from "axios";
import { getErrorMessage } from "../../utils/helpers.js";

export async function callSamsaraApi(
  apiKey,
  endpoint,
  method = "GET",
  params = {},
  data = null
) {
  if (!apiKey) {
    throw new Error("[Samsara API] Missing API Key");
  }

  const url = `https://api.samsara.com${endpoint}`;

  try {
    const response = await axios({
      method,
      url,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: "application/json",
      },
      params,
      data,
      timeout: 60000,
    });

    return response.data;
  } catch (error) {
    const message = getErrorMessage(error);
    throw new Error(`[Samsara API] Request failed: ${message}`);
  }
}

export async function fetchAllSamsaraPages(apiKey, endpoint, params = {}) {
  let allData = [];
  let hasNextPage = true;
  let endCursor = null;

  while (hasNextPage) {
    const currentParams = { ...params };
    if (endCursor) {
      currentParams.after = endCursor;
    }

    const response = await callSamsaraApi(apiKey, endpoint, "GET", currentParams);
    
    if (response.data && Array.isArray(response.data)) {
      allData = allData.concat(response.data);
    } else if (response.data) {
      allData.push(response.data);
    }

    if (response.pagination?.hasNextPage) {
      endCursor = response.pagination.endCursor;
    } else {
      hasNextPage = false;
    }
  }

  return allData;
}
