/**
 * SIA Renterd Client
 * API client for SIA renterd storage operations
 */

export function getBaseUrl(cfg) {
	return `http://${cfg.host}:${cfg.port}`;
}

export function buildAuthHeader(cfg) {
	const token = btoa(':' + cfg.apiPassword);
	return { 'Authorization': `Basic ${token}` };
}

export async function testConnection(cfg) {
	const base = getBaseUrl(cfg);
	const endpoints = ['/api/worker/state', '/api/bus/state'];
	let lastError = '';
	for (const ep of endpoints) {
		try {
			const res = await fetch(base + ep, { headers: buildAuthHeader(cfg) });
			if (res.ok) return { ok: true, status: res.status, endpoint: ep };
			lastError = `HTTP ${res.status} at ${ep}`;
		} catch (e) {
			lastError = `${e?.message || 'Network error'} at ${ep}`;
		}
	}
	return { ok: false, status: 0, endpoint: '', error: lastError || 'All endpoints failed' };
}

export function computeBucketName(mode, userId) {
	if (mode === 'SecureSphere') {
		if (!userId) throw new Error('userId required for SecureSphere mode');
		return `user-vault-${userId}`;
	}
	return 'vault';
}

export async function ensureBucket(cfg, bucket) {
	const url = `${getBaseUrl(cfg)}/api/bus/buckets`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...buildAuthHeader(cfg)
		},
		body: JSON.stringify({ name: bucket })
	});
	if (!res.ok && res.status !== 409) {
		const txt = await res.text().catch(() => '');
		throw new Error(`Bucket ensure failed (${res.status}): ${txt}`);
	}
}

export async function listObjects(cfg, bucket) {
	const url = `${getBaseUrl(cfg)}/api/bus/objects/?bucket=${encodeURIComponent(bucket)}`;
	const res = await fetch(url, { headers: buildAuthHeader(cfg) });
	if (!res.ok) throw new Error(`List failed: HTTP ${res.status}`);
	const data = await res.json();
	return (data.objects || []).map(o => ({ key: o.key, size: o.size || 0, modTime: o.modTime }));
}

export async function uploadObject(cfg, bucket, key, body) {
	const url = `${getBaseUrl(cfg)}/api/worker/object/${encodeURIComponent(key)}?bucket=${encodeURIComponent(bucket)}`;
	const res = await fetch(url, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/octet-stream',
			...buildAuthHeader(cfg)
		},
		body
	});
	if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
}

export async function downloadObject(cfg, bucket, key) {
	const url = `${getBaseUrl(cfg)}/api/worker/object/${encodeURIComponent(key)}?bucket=${encodeURIComponent(bucket)}`;
	const res = await fetch(url, { headers: buildAuthHeader(cfg) });
	if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
	const buf = await res.arrayBuffer();
	return new Uint8Array(buf);
}

export async function deleteObject(cfg, bucket, key) {
	const url = `${getBaseUrl(cfg)}/api/worker/object/${encodeURIComponent(key)}?bucket=${encodeURIComponent(bucket)}`;
	const res = await fetch(url, {
		method: 'DELETE',
		headers: buildAuthHeader(cfg)
	});
	if (!res.ok) throw new Error(`Delete failed: HTTP ${res.status}`);
}

export function buildObjectKey(originalName, originalSize) {
	const ts = Date.now();
	const dot = originalName.lastIndexOf('.');
	if (dot > 0) {
		const base = originalName.slice(0, dot);
		const ext = originalName.slice(dot);
		return `${base}_${ts}${ext}.orig${originalSize}`;
	}
	return `${originalName}_${ts}.orig${originalSize}`;
}
