const AUTH_STORAGE_KEY_PERSISTENT = "consultor_iso9001.auth_session";
const AUTH_STORAGE_KEY_SESSION = "consultor_iso9001.auth_session.temp";

function normalizeSession(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  if (typeof raw.access_token !== "string" || !raw.access_token.trim()) {
    return null;
  }

  return {
    access_token: raw.access_token,
    token_type: typeof raw.token_type === "string" ? raw.token_type : "bearer",
    user: raw.user && typeof raw.user === "object" ? raw.user : null,
    consultancy: raw.consultancy && typeof raw.consultancy === "object" ? raw.consultancy : null,
  };
}

function loadFromLocalStorage() {
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY_PERSISTENT);
  if (!raw) {
    return null;
  }

  try {
    return normalizeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

function loadFromSessionStorage() {
  const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY_SESSION);
  if (!raw) {
    return null;
  }

  try {
    return normalizeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadAuthSession(options = {}) {
  const withMeta = Boolean(options.withMeta);
  if (typeof window === "undefined") {
    return withMeta ? { session : null, persistent: true } : null;
  }

  const fromSession = loadFromSessionStorage();
  if (fromSession) {
    return withMeta ? { session : fromSession, persistent: false } : fromSession;
  }

  const fromLocal = loadFromLocalStorage();
  if (fromLocal) {
    return withMeta ? { session : fromLocal, persistent: true } : fromLocal;
  }
  return withMeta ? { session: null, persistent: true } : null;
}

export function saveAuthSession(session, options = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeSession(session);
  const persistent = options.persistent ?? true;
  if (!normalized) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY_PERSISTENT);
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY_SESSION);
    return;
  }

  const serialized = JSON.stringify(normalized);
  if (persistent) {
    window.localStorage.setItem(AUTH_STORAGE_KEY_PERSISTENT, serialized);
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY_SESSION);
    return;
  }

  window.sessionStorage.setItem(AUTH_STORAGE_KEY_SESSION, serialized);
  window.localStorage.removeItem(AUTH_STORAGE_KEY_PERSISTENT);
}

export function clearAuthSession() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_STORAGE_KEY_PERSISTENT);
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY_SESSION);
}

export function getAccessToken() {
  return loadAuthSession()?.access_token ?? null;
}
