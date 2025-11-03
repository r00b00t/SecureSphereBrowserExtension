/**
 * QR Authentication Service
 * Manages QR auth session lifecycle and polling
 */

import { QrAuthApi, QrAuthApiError } from './qr-auth-api.js';

export class QrAuthService {
	constructor(api) {
		this.api = api;
		this.currentSession = null;
		this.pollIntervalId = null;
		this.timeoutId = null;
		this.callbacks = {};
		this.POLL_INTERVAL = 2000;
		this.SESSION_TIMEOUT = 5 * 60 * 1000;
	}

	setCallbacks(callbacks) {
		this.callbacks = { ...this.callbacks, ...callbacks };
	}

	static generateSessionId() {
		const randomBytes = new Uint8Array(32);
		crypto.getRandomValues(randomBytes);
		return Array.from(randomBytes)
			.map(b => b.toString(16).padStart(2, '0'))
			.join('')
			.substring(0, 16);
	}

	static createQrPayload(sessionId, timestamp) {
		return JSON.stringify({
			session_id: sessionId,
			timestamp: timestamp,
			type: 'qr_login',
			app: 'securesphere'
		});
	}

	async startSession() {
		this.cancelSession();

		const sessionId = QrAuthService.generateSessionId();
		const timestamp = Date.now();
		const createdAt = Date.now();

		try {
			await this.api.createSession(sessionId, timestamp);

			this.currentSession = {
				sessionId,
				timestamp,
				createdAt,
				status: 'pending'
			};

			this.startPolling();
			this.startTimeout();

			return this.currentSession;
		} catch (error) {
			this.currentSession = null;
			if (error instanceof QrAuthApiError) {
				throw error;
			}
			throw new Error(`Failed to start session: ${error}`);
		}
	}

	cancelSession() {
		this.stopPolling();
		this.stopTimeout();
		if (this.currentSession) {
			this.currentSession.status = 'cancelled';
		}
		this.currentSession = null;
	}

	getCurrentSession() {
		return this.currentSession;
	}

	startPolling() {
		this.stopPolling();

		this.pollIntervalId = setInterval(async () => {
			if (!this.currentSession) {
				this.stopPolling();
				return;
			}

			try {
				const response = await this.api.checkStatus(this.currentSession.sessionId);

				if (this.currentSession) {
					this.currentSession.status = response.status;
					if (response.status === 'authenticated') {
						this.currentSession.userId = response.user_id;
						this.currentSession.publicKey = response.public_key;
					}
				}

				if (this.callbacks.onStatusChange && this.currentSession) {
					this.callbacks.onStatusChange(this.currentSession);
				}

				if (response.status === 'authenticated' && this.currentSession) {
					this.stopPolling();
					this.stopTimeout();
					if (this.callbacks.onAuthenticated) {
						this.callbacks.onAuthenticated(this.currentSession);
					}
				}

				if (response.status === 'expired' || response.status === 'cancelled') {
					this.stopPolling();
					this.stopTimeout();
					if (this.currentSession && this.callbacks.onStatusChange) {
						this.callbacks.onStatusChange(this.currentSession);
					}
				}
			} catch (error) {
				if (error instanceof QrAuthApiError) {
					if (error.code === 'SESSION_NOT_FOUND' || error.code === 'SESSION_EXPIRED') {
						if (this.currentSession) {
							this.currentSession.status = error.code === 'SESSION_EXPIRED' ? 'expired' : 'cancelled';
							if (this.callbacks.onStatusChange) {
								this.callbacks.onStatusChange(this.currentSession);
							}
						}
						this.stopPolling();
						this.stopTimeout();
					} else if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
						if (this.callbacks.onError) {
							this.callbacks.onError(error);
						}
					} else {
						this.stopPolling();
						this.stopTimeout();
						if (this.callbacks.onError) {
							this.callbacks.onError(error);
						}
					}
				} else {
					if (this.callbacks.onError) {
						this.callbacks.onError(error instanceof Error ? error : new Error(String(error)));
					}
				}
			}
		}, this.POLL_INTERVAL);
	}

	stopPolling() {
		if (this.pollIntervalId !== null) {
			clearInterval(this.pollIntervalId);
			this.pollIntervalId = null;
		}
	}

	startTimeout() {
		this.stopTimeout();

		this.timeoutId = setTimeout(() => {
			if (this.currentSession && this.currentSession.status === 'pending') {
				this.currentSession.status = 'expired';
				this.stopPolling();
				if (this.callbacks.onTimeout) {
					this.callbacks.onTimeout();
				}
				if (this.callbacks.onStatusChange) {
					this.callbacks.onStatusChange(this.currentSession);
				}
			}
		}, this.SESSION_TIMEOUT);
	}

	stopTimeout() {
		if (this.timeoutId !== null) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
	}
}
