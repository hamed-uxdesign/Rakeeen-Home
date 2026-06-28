import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function getStoredCredentialIds(userId: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'biometric_credentials', userId));
  if (!snap.exists()) return [];
  return snap.data().credentialIds ?? [];
}

export async function registerTouchID(userId: string, userEmail: string): Promise<string> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Rakeeen', id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: userEmail,
        displayName: 'Rakeeen',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  }) as PublicKeyCredential;

  const credentialId = bufferToBase64url(credential.rawId);

  const ref = doc(db, 'biometric_credentials', userId);
  const existing = await getDoc(ref);
  const ids: string[] = existing.exists() ? (existing.data().credentialIds ?? []) : [];
  await setDoc(ref, { credentialIds: [...ids, credentialId] });

  return credentialId;
}

export async function verifyTouchID(credentialIds: string[]): Promise<boolean> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: credentialIds.map(id => ({
          id: base64urlToBuffer(id),
          type: 'public-key' as const,
          transports: ['internal'] as AuthenticatorTransport[],
        })),
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export function isBiometricSupported(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined';
}
