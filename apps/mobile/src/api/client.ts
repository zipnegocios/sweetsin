import { getToken } from "../auth/session";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://sweetsin.example.com";

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}
