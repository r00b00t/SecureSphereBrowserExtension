/**
 * SecureSphere Authentication Module
 * Implements seed phrase-based authentication with BIP39/BIP32 key derivation
 */

import * as bip39 from '../bip39.browser.js';
import { getSignupUrl, getLoginUrl, getApiHeaders } from '../config/api-config.js';

function bytesToHex(bytes) {
	return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
	if (hex.length % 2 !== 0) throw new Error('Invalid hex');
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = parseInt(hex.substr(i * 2, 2), 16);
	}
	return out;
}

function toBuf(u8) {
	const ab = new ArrayBuffer(u8.byteLength);
	new Uint8Array(ab).set(u8);
	return ab;
}

async function hmacSha512(key, data) {
	const cryptoKey = await crypto.subtle.importKey('raw', toBuf(key), {
		name: 'HMAC',
		hash: 'SHA-512'
	}, false, ['sign']);
	const sig = await crypto.subtle.sign('HMAC', cryptoKey, toBuf(data));
	return new Uint8Array(sig);
}

const SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;

function modN(x) {
	let r = x % SECP256K1_N;
	if (r < 0n) r += SECP256K1_N;
	return r;
}

function ser32(i) {
	const b = new Uint8Array(4);
	const dv = new DataView(b.buffer);
	dv.setUint32(0, i, false);
	return b;
}

function concatBytes(...arrs) {
	const total = arrs.reduce((n, a) => n + a.length, 0);
	const out = new Uint8Array(total);
	let off = 0;
	for (const a of arrs) {
		out.set(a, off);
		off += a.length;
	}
	return out;
}

async function masterFromSeed(seed) {
	const I = await hmacSha512(new TextEncoder().encode('Bitcoin seed'), seed);
	return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

async function deriveChild(parentKey, parentChain, index, hardened) {
	let data;
	if (hardened) {
		data = concatBytes(new Uint8Array([0x00]), parentKey, ser32(index | 0x80000000));
	} else {
		throw new Error('Non-hardened derivation requires secp256k1 public key computation');
	}
	const I = await hmacSha512(parentChain, data);
	const Il = I.slice(0, 32);
	const Ir = I.slice(32);
	const ki = modN(BigInt('0x' + bytesToHex(Il)) + BigInt('0x' + bytesToHex(parentKey)));
	if (ki === 0n) throw new Error('Invalid child key');
	const kiBytes = hexToBytes(ki.toString(16).padStart(64, '0'));
	return { key: kiBytes, chainCode: Ir };
}

let nobleSecp = null;

async function ensureNoble() {
	if (nobleSecp) return nobleSecp;
	try {
		nobleSecp = await import('@noble/secp256k1');
		return nobleSecp;
	} catch (e) {
		throw new Error('Missing @noble/secp256k1 dependency for key derivation');
	}
}

async function pubkeyFromPriv(priv) {
	const secp = await ensureNoble();
	const pub = secp.getPublicKey(priv, true);
	return new Uint8Array(pub);
}

async function deriveChildAny(parentKey, parentChain, index, hardened) {
	if (hardened) {
		return deriveChild(parentKey, parentChain, index, true);
	} else {
		const pub = await pubkeyFromPriv(parentKey);
		const data = concatBytes(pub, ser32(index));
		const I = await hmacSha512(parentChain, data);
		const Il = I.slice(0, 32);
		const Ir = I.slice(32);
		const ki = modN(BigInt('0x' + bytesToHex(Il)) + BigInt('0x' + bytesToHex(parentKey)));
		if (ki === 0n) throw new Error('Invalid child key');
		const kiBytes = hexToBytes(ki.toString(16).padStart(64, '0'));
		return { key: kiBytes, chainCode: Ir };
	}
}

async function derivePathM440(parentKey, parentChain) {
	let k = parentKey, c = parentChain;
	({ key: k, chainCode: c } = await deriveChildAny(k, c, 44, true));
	({ key: k, chainCode: c } = await deriveChildAny(k, c, 0, true));
	({ key: k, chainCode: c } = await deriveChildAny(k, c, 0, true));
	({ key: k, chainCode: c } = await deriveChildAny(k, c, 0, false));
	({ key: k, chainCode: c } = await deriveChildAny(k, c, 0, false));
	return k;
}

async function fetchWithRetry(url, options, retries = 3, backoffs = [250, 500, 1000], timeoutMs = 30000) {
	for (let attempt = 0; attempt < retries; attempt++) {
		const controller = new AbortController();
		const id = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const res = await fetch(url, { ...options, signal: controller.signal });
			clearTimeout(id);
			return res;
		} catch (e) {
			clearTimeout(id);
			if (attempt === retries - 1) throw e;
			await new Promise(r => setTimeout(r, backoffs[Math.min(attempt, backoffs.length - 1)]));
		}
	}
	throw new Error('Unreachable');
}

let inMemoryPrivateKeyHex = null;

export async function deriveKeysFromSeedPhrase(mnemonic) {
	const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
	if (!(await bip39.validateMnemonic(normalized))) {
		throw new Error('Invalid BIP39 mnemonic');
	}
	const seed = await bip39.mnemonicToSeed(normalized);
	const { key: masterKey, chainCode } = await masterFromSeed(seed instanceof Uint8Array ? seed : new Uint8Array(seed));
	const childKey = await derivePathM440(masterKey, chainCode);
	const pub = await pubkeyFromPriv(childKey);
	const privateKeyHex = bytesToHex(childKey);
	const publicKeyHex = bytesToHex(pub);
	inMemoryPrivateKeyHex = privateKeyHex;
	return { privateKeyHex, publicKeyHex };
}

function normalizeUserId(uid) {
	if (uid == null) return '';
	return String(uid);
}

export async function register(publicKeyHex) {
	const url = await getSignupUrl();
	const headers = await getApiHeaders();
	const res = await fetchWithRetry(url, {
		method: 'POST',
		headers,
		body: JSON.stringify({ public_key: publicKeyHex })
	});
	if (res.status === 409) {
		throw Object.assign(new Error('User already exists'), { code: 409 });
	}
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`Register failed: ${res.status} ${text}`);
	}
	const json = await res.json().catch(() => ({}));
	const userId = normalizeUserId(json.uuid ?? json.userId ?? json.user_id);
	if (!userId) throw new Error('Missing userId in response');
	return { userId };
}

export async function login(publicKeyHex) {
	const url = await getLoginUrl();
	const headers = await getApiHeaders();
	const res = await fetchWithRetry(url, {
		method: 'POST',
		headers,
		body: JSON.stringify({ public_key: publicKeyHex })
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`Login failed: ${res.status} ${text}`);
	}
	const json = await res.json().catch(() => ({}));
	const userId = normalizeUserId(json.uuid ?? json.userId ?? json.user_id);
	if (!userId) throw new Error('Missing userId in response');
	return { userId };
}

export async function persistSession(data, opts) {
	const toStore = {
		isLoggedIn: true,
		userId: data.userId,
		publicKey: data.publicKeyHex
	};
	if (opts && opts.encryptedPrivateKeyBlob) {
		toStore.encryptedPrivateKeyBlob = opts.encryptedPrivateKeyBlob;
	}
	await chrome.storage.local.set(toStore);
}

export async function clearSession() {
	inMemoryPrivateKeyHex = null;
	await chrome.storage.local.remove(['isLoggedIn', 'userId', 'publicKey', 'encryptedPrivateKeyBlob']);
}

export async function getSession() {
	const local = await chrome.storage.local.get(['isLoggedIn', 'userId', 'publicKey']);
	return {
		isLoggedIn: !!local.isLoggedIn,
		userId: local.userId ? String(local.userId) : undefined,
		publicKeyHex: local.publicKey || undefined
	};
}

async function deriveAesKeyFromPassphrase(passphrase, salt) {
	const enc = new TextEncoder();
	const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
	return await crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt: toBuf(salt), iterations: 100000, hash: 'SHA-256' },
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

export async function secureStorePrivateKey(privateKeyHex, passphrase) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await deriveAesKeyFromPassphrase(passphrase, salt);
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: toBuf(iv) },
		key,
		toBuf(hexToBytes(privateKeyHex))
	);
	const blob = {
		algo: 'AES-GCM-256-PBKDF2-SHA256',
		salt: bytesToHex(salt),
		iv: bytesToHex(iv),
		ciphertext: bytesToHex(new Uint8Array(ciphertext))
	};
	await chrome.storage.local.set({ encryptedPrivateKeyBlob: blob });
	return { blob };
}

export async function secureLoadPrivateKey(passphrase) {
	const { encryptedPrivateKeyBlob: blob } = await chrome.storage.local.get(['encryptedPrivateKeyBlob']);
	if (!blob) throw new Error('No encrypted key stored');
	const salt = hexToBytes(blob.salt);
	const iv = hexToBytes(blob.iv);
	const key = await deriveAesKeyFromPassphrase(passphrase, salt);
	try {
		const plaintext = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: toBuf(iv) },
			key,
			toBuf(hexToBytes(blob.ciphertext))
		);
		const priv = bytesToHex(new Uint8Array(plaintext));
		inMemoryPrivateKeyHex = priv;
		return priv;
	} catch (e) {
		throw new Error('Incorrect passphrase or corrupt data');
	}
}

export async function getPrivateKey() {
	if (inMemoryPrivateKeyHex) return inMemoryPrivateKeyHex;
	const { encryptedPrivateKeyBlob } = await chrome.storage.local.get(['encryptedPrivateKeyBlob']);
	if (encryptedPrivateKeyBlob) {
		throw new Error('Private key locked. Provide passphrase to unlock.');
	}
	return null;
}

export async function softLoginAfterQr(userId, publicKeyHex) {
	await chrome.storage.local.set({ isLoggedIn: true, userId, publicKey: publicKeyHex });
}

export function lock() {
	inMemoryPrivateKeyHex = null;
}
