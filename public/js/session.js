const SESSION_PATTERN = /^[A-Z0-9]{4,10}$/;

export function normalizeSessionCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

export function isValidSessionCode(value) {
  return SESSION_PATTERN.test(normalizeSessionCode(value));
}

export function getSessionCodeFromUrl() {
  const url = new URL(window.location.href);
  const code = normalizeSessionCode(url.searchParams.get("session"));
  return isValidSessionCode(code) ? code : "";
}

export async function ensureControllerSession() {
  const existing = getSessionCodeFromUrl();
  if (existing) return existing;

  const response = await fetch("/api/sessions", { method: "POST" });
  if (!response.ok) throw new Error("Unable to create a private session.");

  const result = await response.json();
  const sessionCode = normalizeSessionCode(result.sessionCode);
  if (!isValidSessionCode(sessionCode)) {
    throw new Error("The server returned an invalid session code.");
  }

  const url = new URL(window.location.href);
  url.searchParams.set("session", sessionCode);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  return sessionCode;
}

export function updateSessionInUrl(sessionCode, { reload = false } = {}) {
  const code = normalizeSessionCode(sessionCode);
  if (!isValidSessionCode(code)) return false;

  const url = new URL(window.location.href);
  url.searchParams.set("session", code);

  if (reload) {
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  } else {
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return true;
}

export function buildCameraUrl(sessionCode) {
  const url = new URL("camera.html", window.location.href);
  url.searchParams.set("session", normalizeSessionCode(sessionCode));
  return url.href;
}

export function formatSessionCode(sessionCode) {
  const code = normalizeSessionCode(sessionCode);
  if (code.length === 6) return `${code.slice(0, 3)}-${code.slice(3)}`;
  return code;
}

export function getOrCreateCameraKey(sessionCode) {
  const storageKey = `replay-assistant-camera-key:${normalizeSessionCode(sessionCode)}`;
  let existing = "";

  try {
    existing = localStorage.getItem(storageKey) || "";
  } catch (error) {
    console.warn("Local storage is unavailable for the camera identity.", error);
  }

  if (/^[A-Za-z0-9_-]{8,80}$/.test(existing)) return existing;

  const generated = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    localStorage.setItem(storageKey, generated);
  } catch (error) {
    console.warn("Unable to save the camera identity.", error);
  }

  return generated;
}
