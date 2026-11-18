import access from "./local-owner-access.json";
// This gate protects the local settings UI from accidental edits, not shared server data.
// There is no private backend or customer database in this static site.
export async function checkLocalPassword(password: string) {
  if (!password || password.length > 128) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(access.salt), iterations: access.iterations }, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2,"0")).join("") === access.digest;
}
