/**
 * SecureSphere Vault Encryption
 * File encryption using private key-derived master key
 */

let __testIvOverride = null;

export function __setTestIv(iv) {
	__testIvOverride = iv;
}

export function hexToBytes(hex) {
	if (!hex || hex.length % 2 !== 0) throw new Error('Invalid hex');
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		const byte = hex.substr(i * 2, 2);
		const val = parseInt(byte, 16);
		if (isNaN(val)) throw new Error('Invalid hex');
		out[i] = val;
	}
	return out;
}

export async function sha256(data) {
	const buf = await crypto.subtle.digest('SHA-256', data);
	return new Uint8Array(buf);
}

export function base64Encode(data) {
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < data.length; i += chunk) {
		const sub = data.subarray(i, Math.min(i + chunk, data.length));
		binary += String.fromCharCode.apply(null, Array.from(sub));
	}
	return btoa(binary);
}

export function base64Decode(b64) {
	const binary = atob(b64);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		out[i] = binary.charCodeAt(i);
	}
	return out;
}

function concatBytes(...parts) {
	const total = parts.reduce((acc, p) => acc + p.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const p of parts) {
		out.set(p, offset);
		offset += p.length;
	}
	return out;
}

export async function deriveMasterKey(privateKeyHex) {
	const priv = hexToBytes(privateKeyHex);
	return sha256(priv);
}

export async function deriveFileKey(masterKey, filename, originalSize) {
	const enc = new TextEncoder();
	const nameBytes = enc.encode(filename);
	const sizeBytes = enc.encode(String(originalSize));
	const concat = concatBytes(nameBytes, sizeBytes, masterKey);
	const fileKeyBytes = await sha256(concat);
	return crypto.subtle.importKey('raw', fileKeyBytes, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
}

export async function encryptForSia(fileBytes, privateKeyHex, uniqueFilename) {
	const originalSize = fileBytes.length;
	const masterKey = await deriveMasterKey(privateKeyHex);
	const fileKey = await deriveFileKey(masterKey, uniqueFilename, originalSize);
	const iv = __testIvOverride ?? crypto.getRandomValues(new Uint8Array(16));
	const b64 = base64Encode(fileBytes);
	const plain = new TextEncoder().encode(b64);
	const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, fileKey, plain));
	const out = new Uint8Array(iv.length + ct.length);
	out.set(iv, 0);
	out.set(ct, iv.length);
	const siaKey = `${uniqueFilename}.orig${originalSize}`;
	return { bytes: out, siaKey, originalSize };
}

export async function decryptFromSia(downloadedBytes, privateKeyHex, siaKey) {
	if (!siaKey || !/\.orig\d+$/.test(siaKey)) {
		throw new Error('Invalid Sia key suffix');
	}
	const suffixIdx = siaKey.lastIndexOf('.orig');
	const baseFilename = siaKey.slice(0, suffixIdx);
	const originalSizeStr = siaKey.slice(suffixIdx + 5);
	const originalSize = parseInt(originalSizeStr, 10);
	if (!Number.isFinite(originalSize) || originalSize < 0) {
		throw new Error('Invalid original size');
	}
	if (!downloadedBytes || downloadedBytes.length < 17) {
		throw new Error('Invalid payload: too short');
	}
	const iv = downloadedBytes.slice(0, 16);
	const ct = downloadedBytes.slice(16);
	const masterKey = await deriveMasterKey(privateKeyHex);
	const fileKey = await deriveFileKey(masterKey, baseFilename, originalSize);
	let plainBuf;
	try {
		plainBuf = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, fileKey, ct);
	} catch (e) {
		throw new Error('Decrypt failed');
	}
	const b64 = new TextDecoder().decode(new Uint8Array(plainBuf));
	const fileBytes = base64Decode(b64);
	return fileBytes;
}

export function generateUniqueFilename(originalName) {
	const timestamp = Date.now();
	const dot = originalName.lastIndexOf('.');
	if (dot > 0) {
		const base = originalName.slice(0, dot);
		const ext = originalName.slice(dot);
		return `${base}_${timestamp}${ext}`;
	}
	return `${originalName}_${timestamp}`;
}
