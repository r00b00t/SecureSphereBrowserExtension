/**
 * QR Authentication UI
 * Handles QR code display and status updates in the popup
 */

import { getQrAuthController } from './qr-auth-controller.js';

export class QrAuthUI {
	constructor() {
		this.controller = getQrAuthController();
		this.qrContainer = null;
		this.statusContainer = null;
		this.startButton = null;
		this.currentSession = null;
	}

	async initialize() {
		await this.controller.initialize();

		this.qrContainer = document.getElementById('qrCodeContainer');
		this.statusContainer = document.getElementById('qrStatus');
		this.startButton = document.getElementById('startQrSessionBtn');

		if (this.startButton) {
			this.startButton.addEventListener('click', () => this.handleStartSession());
		}

		await this.updateLoggedInState();
	}

	async handleStartSession() {
		try {
			if (this.startButton) {
				this.startButton.setAttribute('disabled', 'true');
				if (this.startButton instanceof HTMLButtonElement) {
					this.startButton.textContent = 'Starting...';
				}
			}

			this.showStatus('Creating session...', 'info');

			const result = await this.controller.createSession();

			if (!result.success) {
				this.showStatus(result.error || 'Failed to start session', 'error');
				if (this.startButton) {
					this.startButton.removeAttribute('disabled');
					if (this.startButton instanceof HTMLButtonElement) {
						this.startButton.textContent = 'Login with Mobile App';
					}
				}
				return;
			}

			if (result.session && result.qrPayload) {
				this.currentSession = result.session;
				this.displayQrCode(result.qrPayload);
				this.showStatus('Scan the QR code with your mobile app', 'info');
				this.startPolling();
			}
		} catch (error) {
			this.showStatus(error.message || 'Failed to start session', 'error');
			if (this.startButton) {
				this.startButton.removeAttribute('disabled');
				if (this.startButton instanceof HTMLButtonElement) {
					this.startButton.textContent = 'Login with Mobile App';
				}
			}
		}
	}

	async displayQrCode(qrPayload) {
		if (!this.qrContainer) return;

		this.qrContainer.innerHTML = '';

		const canvas = document.createElement('canvas');
		canvas.id = 'qrCodeCanvas';
		canvas.style.maxWidth = '100%';
		canvas.style.height = 'auto';
		this.qrContainer.appendChild(canvas);

		try {
			const QRCode = (await import('qrcode')).default;

			await QRCode.toCanvas(canvas, qrPayload, {
				width: 256,
				margin: 2,
				color: {
					dark: '#2e7d32',
					light: '#ffffff'
				}
			});
		} catch (error) {
			this.qrContainer.innerHTML = `<pre style="background: #1e1e1e; padding: 16px; border-radius: 8px; color: #2e7d32; font-size: 10px; word-break: break-all;">${qrPayload}</pre>`;
			this.showStatus('Failed to generate QR code. Showing payload as text.', 'warning');
		}
	}

	startPolling() {
		const checkInterval = setInterval(async () => {
			const session = this.controller.getCurrentSession();
			if (!session) {
				clearInterval(checkInterval);
				return;
			}

			if (session.status === 'authenticated') {
				clearInterval(checkInterval);
				await this.handleAuthenticated(session);
			} else if (session.status === 'expired' || session.status === 'cancelled') {
				clearInterval(checkInterval);
				this.showStatus(`Session ${session.status}`, 'error');
				if (this.startButton) {
					this.startButton.removeAttribute('disabled');
					if (this.startButton instanceof HTMLButtonElement) {
						this.startButton.textContent = 'Login with Mobile App';
					}
				}
			}
		}, 2000);
	}

	async handleAuthenticated(session) {
		this.showStatus('Authenticated successfully!', 'success');

		try {
			const Auth = await import('./index.js');
			await Auth.softLoginAfterQr(session.userId, session.publicKey);
		} catch (e) {
			// Silent fail - session may already be persisted
		}

		await this.updateLoggedInState();

		try {
			chrome.runtime.sendMessage({
				type: 'QR_AUTH_LOGIN_SUCCESS',
				userId: session.userId,
				publicKey: session.publicKey
			}).catch(() => {});
		} catch (e) {
			// Ignore errors
		}

		const postQrSeedPrompt = document.getElementById('postQrSeedPrompt');
		if (postQrSeedPrompt) {
			postQrSeedPrompt.style.display = 'block';
		}

		setTimeout(() => {
			if (this.qrContainer) {
				this.qrContainer.innerHTML = '';
			}
		}, 3000);
	}

	showStatus(message, type = 'info') {
		if (!this.statusContainer) return;

		this.statusContainer.textContent = message;
		this.statusContainer.className = `status-message ${type}`;
		this.statusContainer.style.display = 'block';

		if (type === 'success') {
			setTimeout(() => {
				if (this.statusContainer) {
					this.statusContainer.style.display = 'none';
				}
			}, 5000);
		}
	}

	async updateLoggedInState() {
		const storage = await chrome.storage.local.get(['isLoggedIn', 'userId']);
		if (storage.isLoggedIn && storage.userId) {
			const userInfo = document.getElementById('userInfo');
			if (userInfo) {
				userInfo.textContent = `Logged in as ${storage.userId}`;
			}
		}
	}

	cancelSession() {
		this.controller.cancelSession();
		if (this.qrContainer) {
			this.qrContainer.innerHTML = '';
		}
		this.showStatus('Session cancelled', 'info');
		if (this.startButton) {
			this.startButton.removeAttribute('disabled');
			if (this.startButton instanceof HTMLButtonElement) {
				this.startButton.textContent = 'Login with Mobile App';
			}
		}
	}
}

export const qrAuthUI = new QrAuthUI();
