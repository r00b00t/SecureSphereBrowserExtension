/**
 * QR Authentication Controller
 * Coordinates between UI, background service, and QR auth service
 */

import { QrAuthApi } from './qr-auth-api.js';
import { QrAuthService } from './qr-auth-service.js';
import * as Auth from './index.js';

export class QrAuthController {
	constructor() {
		this.api = null;
		this.service = null;
		this.isInitialized = false;
	}

	async initialize() {
		if (this.isInitialized) return;

		try {
			const config = await QrAuthApi.getConfig();
			if (!config.baseUrl) {
				throw new Error('Base URL not configured. Please set it in options.');
			}

			this.api = new QrAuthApi(config);
			this.service = new QrAuthService(this.api);

			this.service.setCallbacks({
				onAuthenticated: async (session) => {
					if (session.userId && session.publicKey) {
						await Auth.softLoginAfterQr(session.userId, session.publicKey);

						try {
							chrome.runtime.sendMessage({
								type: 'QR_AUTH_LOGIN_SUCCESS',
								userId: session.userId,
								publicKey: session.publicKey
							}).catch(() => {});
						} catch (e) {
							// Ignore errors
						}
					}
				},
				onError: (error) => {
					// Error handling delegated to UI
				},
				onTimeout: () => {
					// Timeout handling delegated to UI
				}
			});

			this.isInitialized = true;
		} catch (error) {
			throw error;
		}
	}

	async createSession() {
		try {
			if (!this.isInitialized) {
				await this.initialize();
			}

			if (!this.service) {
				throw new Error('Service not initialized');
			}

			const session = await this.service.startSession();
			const qrPayload = QrAuthService.createQrPayload(session.sessionId, session.timestamp);

			return {
				success: true,
				session,
				qrPayload
			};
		} catch (error) {
			return {
				success: false,
				error: error.message || 'Failed to create session'
			};
		}
	}

	async checkStatus() {
		try {
			if (!this.service) {
				await this.initialize();
			}

			const session = this.service?.getCurrentSession();
			if (!session) {
				return {
					success: false,
					error: 'No active session'
				};
			}

			if (!this.api) {
				throw new Error('API not initialized');
			}

			const response = await this.api.checkStatus(session.sessionId);

			if (this.service && session) {
				session.status = response.status;
				if (response.status === 'authenticated') {
					session.userId = response.user_id;
					session.publicKey = response.public_key;
				}
			}

			return {
				success: true,
				status: response.status,
				authenticated: response.status === 'authenticated',
				userId: response.user_id,
				publicKey: response.public_key
			};
		} catch (error) {
			return {
				success: false,
				error: error.message || 'Failed to check status'
			};
		}
	}

	cancelSession() {
		if (this.service) {
			this.service.cancelSession();
		}
	}

	getCurrentSession() {
		return this.service?.getCurrentSession() || null;
	}
}

let qrAuthControllerInstance = null;

export function getQrAuthController() {
	if (!qrAuthControllerInstance) {
		qrAuthControllerInstance = new QrAuthController();
	}
	return qrAuthControllerInstance;
}
