/**
 * Vault Encryption Utilities
 * AES-256-CBC encryption with PBKDF2 key derivation
 */

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function base64FromArrayBuffer(buf) {
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function arrayBufferFromBase64(b64) {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

async function fingerprintKey(key, salt) {
	const raw = await crypto.subtle.exportKey('raw', key);
	const toHash = new Uint8Array(raw.byteLength + salt.byteLength);
	toHash.set(new Uint8Array(raw), 0);
	toHash.set(salt, new Uint8Array(raw).length);
	const digest = await crypto.subtle.digest('SHA-256', toHash);
	const b64 = base64FromArrayBuffer(digest);
	return b64.slice(0, 16);
}

export async function deriveAesCbcKeyFromPassphrase(passphrase, saltBase64, iterations = 250000) {
	const salt = saltBase64 ? new Uint8Array(arrayBufferFromBase64(saltBase64)) : crypto.getRandomValues(new Uint8Array(16));
	const passKey = await crypto.subtle.importKey('raw', TEXT_ENCODER.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
	const key = await crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
		passKey,
		{ name: 'AES-CBC', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
	const info = {
		keyId: await fingerprintKey(key, salt),
		saltBase64: base64FromArrayBuffer(salt.buffer),
		iterations,
		keyAlgorithm: 'AES-CBC',
		keyLength: 256,
		createdAt: Date.now()
	};
	return { key, info };
}

export async function encryptBytesAesCbc(plainBytes, key) {
	const iv = crypto.getRandomValues(new Uint8Array(16));
	const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, plainBytes));
	const result = new Uint8Array(iv.length + ciphertext.length);
	result.set(iv, 0);
	result.set(ciphertext, iv.length);
	return result;
}

export async function decryptBytesAesCbc(prefixedBytes, key) {
	if (prefixedBytes.byteLength < 16) throw new Error('Invalid payload: too short');
	const iv = prefixedBytes.slice(0, 16);
	const ct = prefixedBytes.slice(16);
	const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ct);
	return new Uint8Array(plain);
}

export async function getOrInitVaultKey() {
	const syncData = await chrome.storage.sync.get(['vaultPassphraseMeta']);
	const localData = await chrome.storage.local.get(['vaultPassphrase']);
	const meta = syncData.vaultPassphraseMeta;
	if (meta && meta.saltBase64 && meta.iterations && localData.vaultPassphrase) {
		return deriveAesCbcKeyFromPassphrase(localData.vaultPassphrase, meta.saltBase64, meta.iterations);
	}
	throw new Error('Vault key not initialized');
}

export async function setVaultPassphrase(passphrase) {
	const { key, info } = await deriveAesCbcKeyFromPassphrase(passphrase);
	await chrome.storage.local.set({ vaultPassphrase: passphrase });
	await chrome.storage.sync.set({ vaultPassphraseMeta: info });
	return info;
}

export function looksLikeIvPrefixed(data) {
	return data && data.byteLength >= 16;
}

export function utf8ToBytes(text) {
	return TEXT_ENCODER.encode(text);
}

export function bytesToUtf8(bytes) {
	return TEXT_DECODER.decode(bytes);
}
