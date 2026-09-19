import HmacSHA256 from "crypto-js/hmac-sha256";
import Hex from "crypto-js/enc-hex";
import { getToken } from "../auth/session";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://sweetsin.example.com";
const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET ?? "";

function signBody(body: string): string {
  return HmacSHA256(body, APP_SECRET).toString(Hex);
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  if (path === "/api/mobile/auth/login" && typeof init.body === "string") {
    headers.set("X-App-Signature", signBody(init.body));
  }

  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}
