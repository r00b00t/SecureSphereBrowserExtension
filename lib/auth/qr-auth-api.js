/**
 * QR Authentication API Client
 */

import { getApiConfig, getQrAuthCreateSessionUrl, getQrAuthCheckStatusUrl, getApiHeaders } from '../config/api-config.js';

export class QrAuthApiError extends Error {
	constructor(message, statusCode, code) {
		super(message);
		this.name = 'QrAuthApiError';
		this.statusCode = statusCode;
		this.code = code;
	}
}

export class QrAuthApi {
	constructor(config) {
		this.config = {
			baseUrl: config.baseUrl,
			apiKey: config.apiKey
		};
	}

	static async getConfig() {
		const config = await getApiConfig();
		return { baseUrl: config.baseUrl, apiKey: config.apiKey };
	}

	async createSession(sessionId, timestamp) {
		const url = await getQrAuthCreateSessionUrl();
		const body = { session_id: sessionId, timestamp };

		return this.fetchWithRetry(url, {
			method: 'POST',
			headers: await getApiHeaders(),
			body: JSON.stringify(body)
		}).then(async (response) => {
			if (!response.ok) {
				const errorText = await response.text().catch(() => '');
				if (response.status === 409) {
					throw new QrAuthApiError('Session already exists', 409, 'SESSION_EXISTS');
				}
				if (response.status === 400) {
					throw new QrAuthApiError(`Invalid request: ${errorText}`, 400, 'INVALID_REQUEST');
				}
				throw new QrAuthApiError(`Failed to create session: ${response.status} ${errorText}`, response.status);
			}
			return response.json();
		});
	}

	async checkStatus(sessionId) {
		const url = await getQrAuthCheckStatusUrl(sessionId);

		return this.fetchWithRetry(url, {
			method: 'GET',
			headers: await getApiHeaders()
		}).then(async (response) => {
			if (!response.ok) {
				const errorText = await response.text().catch(() => '');
				if (response.status === 404) {
					throw new QrAuthApiError('Session not found', 404, 'SESSION_NOT_FOUND');
				}
				if (response.status === 410) {
					throw new QrAuthApiError('Session expired', 410, 'SESSION_EXPIRED');
				}
				throw new QrAuthApiError(`Failed to check status: ${response.status} ${errorText}`, response.status);
			}
			return response.json();
		});
	}

	async fetchWithRetry(url, options, retries = 3, backoffs = [250, 500, 1000], timeoutMs = 30000) {
		for (let attempt = 0; attempt < retries; attempt++) {
			const controller = new AbortController();
			const id = setTimeout(() => controller.abort(), timeoutMs);
			try {
				const res = await fetch(url, { ...options, signal: controller.signal });
				clearTimeout(id);
				return res;
			} catch (e) {
				clearTimeout(id);
				if (attempt === retries - 1) {
					if (e.name === 'AbortError') {
						throw new QrAuthApiError('Request timeout', 0, 'TIMEOUT');
					}
					if (e.name === 'TypeError' && e.message.includes('fetch')) {
						throw new QrAuthApiError('Network error - check your connection', 0, 'NETWORK_ERROR');
					}
					throw e;
				}
				await new Promise(r => setTimeout(r, backoffs[Math.min(attempt, backoffs.length - 1)]));
			}
		}
		throw new QrAuthApiError('Unreachable', 0);
	}
}
