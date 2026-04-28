import { clearAuthSession, getAccessToken } from "./authStorage";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 20000;

function extractErrorMessage(payload, fallbackMessage) {
  if (payload && typeof payload === "object") {
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  }
  return fallbackMessage;
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function requestJson(
  path,
  { method = "GET", body, timeoutMs = REQUEST_TIMEOUT_MS, fallbackMessage = "Error en la solicitud" } = {}
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = body ? { "Content-Type": "application/json" } : {};
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await parseJsonSafe(response) : null;

    if (!response.ok) {
      if (response.status === 401) {
        clearAuthSession();
        if (typeof window !== "undefined") {
          const publicPaths = ["/login", "/register"];
          const currentPath = window.location.pathname;
          if (!publicPaths.includes(currentPath)) {
            window.location.assign("/login");
          }
        }
      }
      throw new Error(extractErrorMessage(payload, fallbackMessage));
    }

    return payload;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Timeout en la solicitud");
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(fallbackMessage);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function requestBlob(
  path,
  { method = "GET", body, timeoutMs = REQUEST_TIMEOUT_MS, fallbackMessage = "Error en la solicitud" } = {}
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = body ? { "Content-Type": "application/json" } : {};
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      let payload = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        payload = await parseJsonSafe(response);
      }
      if (response.status === 401) {
        clearAuthSession();
        if (typeof window !== "undefined") {
          const publicPaths = ["/login", "/register"];
          const currentPath = window.location.pathname;
          if (!publicPaths.includes(currentPath)) {
            window.location.assign("/login");
          }
        }
      }
      throw new Error(extractErrorMessage(payload, fallbackMessage));
    }

    return await response.blob();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Timeout en la solicitud");
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(fallbackMessage);
  } finally {
    clearTimeout(timeoutId);
  }
}
