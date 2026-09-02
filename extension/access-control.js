const TEST_EMAIL = "wmarcondesbr@gmail.com";
const VALIDATION_ENDPOINT = "https://chronoclick.app/api/v1/access/validate";
const TEST_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const ONLINE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

function normalized(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export async function accessStatus() {
  const { chronoAccess } = await chrome.storage.local.get("chronoAccess");
  const valid =
    chronoAccess?.email &&
    chronoAccess?.expiresAt &&
    new Date(chronoAccess.expiresAt).getTime() > Date.now();
  if (!valid) return { authenticated: false };
  if (
    chronoAccess.source === "chronoclick.app" &&
    Date.now() - new Date(chronoAccess.lastCheckedAt || 0).getTime() > ONLINE_CHECK_INTERVAL_MS
  ) {
    try {
      return await validateAccess(chronoAccess.email, chronoAccess.token);
    } catch (error) {
      await chrome.storage.local.remove("chronoAccess");
      return { authenticated: false, error: error.message };
    }
  }
  return { authenticated: true, ...chronoAccess };
}

export async function validateAccess(email, currentToken = null) {
  email = normalized(email);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Informe um e-mail válido.");
  let access;
  if (email === TEST_EMAIL) {
    access = {
      email,
      plan: "teste",
      source: "test-allowlist",
      expiresAt: new Date(Date.now() + TEST_DURATION_MS).toISOString(),
    };
  } else {
    let response;
    try {
      response = await fetch(VALIDATION_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, extensionId: chrome.runtime.id, token: currentToken }),
      });
    } catch {
      throw new Error("A validação online ainda não está disponível para este e-mail.");
    }
    if (!response.ok) throw new Error("Este e-mail ainda não tem acesso ao ChronoClick.");
    const payload = await response.json();
    if (!payload.allowed || !payload.expiresAt)
      throw new Error(payload.message || "Este e-mail ainda não tem acesso ao ChronoClick.");
    access = {
      email,
      plan: payload.plan || "licença",
      source: "chronoclick.app",
      expiresAt: payload.expiresAt,
      token: payload.token || null,
      lastCheckedAt: new Date().toISOString(),
    };
  }
  await chrome.storage.local.set({ chronoAccess: access });
  return { authenticated: true, ...access };
}

export async function clearAccess() {
  await chrome.storage.local.remove("chronoAccess");
  return { authenticated: false };
}
