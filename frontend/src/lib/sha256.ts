import { sha256 } from "js-sha256";

const CHUNK_SIZE = 4 * 1024 * 1024;

function hasSubtleCrypto(): boolean {
  return typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.subtle?.digest === "function";
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 en hex; funciona en HTTP (sin crypto.subtle, p. ej. http://IP:5173). */
async function sha256HexSubtle(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return bufferToHex(hash);
}

/** Fallback puro JS (js-sha256), por trozos para ficheros grandes. */
async function sha256HexPure(file: File): Promise<string> {
  const hash = sha256.create();
  let offset = 0;
  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buf = await slice.arrayBuffer();
    hash.update(new Uint8Array(buf));
    offset += CHUNK_SIZE;
  }
  return hash.hex();
}

export async function sha256Hex(file: File): Promise<string> {
  if (hasSubtleCrypto()) {
    try {
      return await sha256HexSubtle(file);
    } catch {
      /* contexto inseguro o fichero demasiado grande para subtle */
    }
  }
  return sha256HexPure(file);
}
