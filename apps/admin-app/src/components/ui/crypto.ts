import { api } from "@sbjiwala/shared";

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
  const keyBuffer = pemToArrayBuffer(pem);
  return window.crypto.subtle.importKey(
    "spki",
    keyBuffer,
    {
      name: "RSA-OAEP",
      hash: { name: "SHA-256" },
    },
    false,
    ["encrypt"]
  );
}

export interface EncryptedPayload {
  encrypted_key: string;
  encrypted_payload: string;
  iv: string;
  tag: string;
}

/**
 * Encrypts a sensitive payload dictionary using dynamic E2EE (AES-256-GCM session key + RSA-OAEP).
 */
export async function encryptPayload(payload: Record<string, any>): Promise<EncryptedPayload> {
  // 1. Fetch server E2EE public key
  const keyRes = await api.get("/auth/e2ee/key");
  if (!keyRes.success || !keyRes.data?.public_key) {
    throw new Error("Failed to fetch server security credentials");
  }

  const publicKeyPem = keyRes.data.public_key;
  const publicKey = await importPublicKey(publicKeyPem);

  // 2. Generate random 256-bit AES-GCM session key
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt"]
  );

  // 3. Encrypt data using AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const rawData = new TextEncoder().encode(JSON.stringify(payload));
  const aesResult = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    aesKey,
    rawData
  );

  // Split WebCrypto GCM output (ciphertext + 16-byte auth tag)
  const aesBytes = new Uint8Array(aesResult);
  const ciphertext = aesBytes.slice(0, -16);
  const tag = aesBytes.slice(-16);

  // 4. Encrypt the AES session key using Server RSA-OAEP public key
  const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const encryptedKeyBytes = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    publicKey,
    exportedAesKey
  );

  return {
    encrypted_key: arrayBufferToBase64(encryptedKeyBytes),
    encrypted_payload: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
    tag: arrayBufferToBase64(tag),
  };
}
