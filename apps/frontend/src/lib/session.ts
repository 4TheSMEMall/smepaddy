export function getStoredAccessToken() {
  if (typeof window === "undefined") return null;

  const token = window.localStorage.getItem("sme_paddy_access_token");
  const expiresAt = window.localStorage.getItem("sme_paddy_access_token_expires_at");

  if (!token || !expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
    return null;
  }

  return token;
}
