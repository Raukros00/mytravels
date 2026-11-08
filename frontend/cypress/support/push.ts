/**
 * Dispositivi "finti" per le notifiche push: generano le chiavi come farebbe il browser
 * (ECDH P-256 + segreto auth) e si abbonano con un endpoint del finto push service dello stub
 * (e2e/api-stubs.py). I messaggi ricevuti dallo stub vengono decifrati qui (aes128gcm, RFC 8291)
 * con WebCrypto, e la firma VAPID (RFC 8292) viene verificata con la chiave pubblica di test.
 */
import { DemoUser } from './users';

const STUB = 'http://127.0.0.1:18090';
/** Chiave pubblica VAPID di test (docker-compose.e2e.yml). */
export const E2E_VAPID_PUBLIC_KEY =
  'BDj5qCEpNwBdu5yOHGiIH0LpAkk4dp-PYWp-6_d5QsfAr7OCuuPpHT54Rkrc-6LxFxRTx3c7p6eFCzFKnqJxW_A';

export interface PushDevice {
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  privateKey: CryptoKey;
  publicRaw: Uint8Array;
  authSecret: Uint8Array;
}

export interface ReceivedPush {
  status: number;
  headers: Record<string, string | null>;
  /** Payload decifrato (JSON inviato dal backend). */
  payload: any;
  /** Claim del JWT VAPID (firma già verificata). */
  vapid: { aud: string; sub: string; exp: number };
}

export function b64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach(b => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64(value: string): Uint8Array {
  const std = value.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(std + '='.repeat((4 - (std.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

const enc = new TextEncoder();
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  parts.forEach(p => {
    out.set(p, i);
    i += p.length;
  });
  return out;
};

async function createDevice(prefix: string): Promise<PushDevice> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  const id = `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  return {
    id,
    endpoint: `http://api-stubs:8000/push/${id}`,
    keys: { p256dh: b64url(publicRaw), auth: b64url(authSecret) },
    privateKey: pair.privateKey,
    publicRaw,
    authSecret,
  };
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource }, key, bytes * 8),
  );
}

/** Decifra un corpo aes128gcm (un solo record) con le chiavi del dispositivo. */
async function decrypt(device: PushDevice, body: Uint8Array): Promise<string> {
  const salt = body.slice(0, 16);
  const idLen = body[20];
  const serverPublic = body.slice(21, 21 + idLen);
  const ciphertext = body.slice(21 + idLen);
  const serverKey = await crypto.subtle.importKey('raw', serverPublic as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: serverKey }, device.privateKey, 256));
  const ikm = await hkdf(device.authSecret, shared, concat(enc.encode('WebPush: info\0'), device.publicRaw, serverPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aes, ciphertext as BufferSource));
  // Padding dell'ultimo record: delimitatore 0x02 seguito da zeri.
  let end = plain.length - 1;
  while (end >= 0 && plain[end] === 0) end--;
  expect(plain[end], 'delimitatore di padding aes128gcm').to.eq(2);
  return new TextDecoder().decode(plain.slice(0, end));
}

/** Verifica l'header `Authorization: vapid t=<jwt>, k=<chiave>` e restituisce i claim del JWT. */
async function verifyVapid(header: string | null): Promise<ReceivedPush['vapid']> {
  const match = /^vapid t=([^,\s]+),\s*k=(\S+)$/.exec(header ?? '');
  expect(match, `header VAPID "${header}"`).to.not.be.null;
  const [, jwt, k] = match!;
  expect(k, 'chiave pubblica VAPID').to.eq(E2E_VAPID_PUBLIC_KEY);
  const [h, p, s] = jwt.split('.');
  expect(JSON.parse(new TextDecoder().decode(fromB64(h))).alg).to.eq('ES256');
  const key = await crypto.subtle.importKey('raw', fromB64(k) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, key, fromB64(s) as BufferSource, enc.encode(`${h}.${p}`) as BufferSource);
  expect(ok, 'firma del JWT VAPID').to.be.true;
  return JSON.parse(new TextDecoder().decode(fromB64(p)));
}

/** Nuovo dispositivo con chiavi proprie, abbonato alle push per l'utente. */
export function subscribeDevice(user: DemoUser, opts: { prefix?: string; lang?: string } = {}): Cypress.Chainable<PushDevice> {
  return cy.then(() => createDevice(opts.prefix ?? 'dev')).then(device =>
    cy.api(user, 'POST', '/api/v1/push/subscriptions', {
      endpoint: device.endpoint, keys: device.keys, ...(opts.lang ? { lang: opts.lang } : {}),
    }).then(() => device),
  );
}

/** Solo le chiavi, senza abbonarsi. */
export function newDevice(prefix = 'dev'): Cypress.Chainable<PushDevice> {
  return cy.then(() => createDevice(prefix));
}

/** Messaggi grezzi ricevuti dallo stub per il dispositivo (status, headers, body in base64). */
export function rawPushes(device: PushDevice): Cypress.Chainable<any[]> {
  return cy.request(`${STUB}/__push?id=${encodeURIComponent(device.id)}`).its('body');
}

/**
 * Attende che il dispositivo abbia ricevuto almeno `count` messaggi (l'invio è asincrono),
 * poi li decifra e verifica la firma VAPID.
 */
export function receivedPushes(device: PushDevice, count = 1, timeout = 10000): Cypress.Chainable<ReceivedPush[]> {
  const started = Date.now();
  const poll = (): Cypress.Chainable<any[]> =>
    rawPushes(device).then(list => {
      if (list.length >= count) return cy.wrap(list, { log: false });
      if (Date.now() - started > timeout) {
        throw new Error(`Il dispositivo ${device.id} ha ricevuto ${list.length} push invece di ${count}`);
      }
      return cy.wait(250, { log: false }).then(poll);
    });
  return poll().then(list =>
    cy.then(() =>
      Promise.all(list.map(async (m: any) => ({
        status: m.status,
        headers: m.headers,
        payload: JSON.parse(await decrypt(device, fromB64(m.body))),
        vapid: await verifyVapid(m.headers.Authorization),
      }))),
    ),
  );
}

/** Verifica che il dispositivo NON riceva push (attende un po', visto che l'invio è asincrono). */
export function expectNoPush(device: PushDevice, waitMs = 1500): void {
  cy.wait(waitMs);
  rawPushes(device).should('have.length', 0);
}
