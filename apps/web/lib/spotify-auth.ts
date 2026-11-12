// Spotify Authorization Code + PKCE, 100% no navegador (sem client secret).
// Tokens ficam no localStorage do proprio usuario.

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
].join(" ");
const KEY = "spotify_tokens";
const VERIFIER_KEY = "spotify_pkce_verifier";
const RETURN_KEY = "spotify_return_to";

interface Stored {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export const spotifyConfigured = () => CLIENT_ID !== "";

function redirectUri() {
  return `${window.location.origin}/spotify/callback`;
}

function randomString(len: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[b % 62]).join("");
}

async function challengeOf(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function load(): Stored | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") as Stored | null;
  } catch {
    return null;
  }
}

export const isSpotifyConnected = () => load() !== null;
export const disconnectSpotify = () => localStorage.removeItem(KEY);

export async function startSpotifyLogin(returnTo: string) {
  const verifier = randomString(64);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(RETURN_KEY, returnTo);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: await challengeOf(verifier),
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

async function tokenRequest(body: Record<string, string>): Promise<Stored | null> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  const previous = load();
  const stored: Stored = {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? previous?.refresh_token ?? "",
    expires_at: Date.now() + json.expires_in * 1000,
  };
  localStorage.setItem(KEY, JSON.stringify(stored));
  return stored;
}

/** Chamado na pagina /spotify/callback. Devolve para onde voltar. */
export async function finishSpotifyLogin(code: string): Promise<string | null> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) return null;
  const ok = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  sessionStorage.removeItem(VERIFIER_KEY);
  const returnTo = sessionStorage.getItem(RETURN_KEY) ?? "/";
  sessionStorage.removeItem(RETURN_KEY);
  return ok ? returnTo : null;
}

/** Access token valido (renova com o refresh token quando perto de expirar). */
export async function getSpotifyToken(): Promise<string> {
  let tokens = load();
  if (!tokens) throw new Error("Spotify nao conectado");
  if (tokens.expires_at - Date.now() < 60_000) {
    tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
    if (!tokens) {
      disconnectSpotify();
      throw new Error("Sessao do Spotify expirou");
    }
  }
  return tokens.access_token;
}
