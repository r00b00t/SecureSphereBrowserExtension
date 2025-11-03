// Secure Authentication Module using UUID and Public Key Verification
import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { generateKeyFromSeedBytes } from '../key/index.js';
import * as bip39 from 'bip39';
import { ENV } from '../config/environment.js';

// Initialize SHA-512 for @noble/ed25519 (required for v2.x)
ed25519.etc.sha512Sync = (...m) => sha512(ed25519.etc.concatBytes(...m));
ed25519.etc.sha512Async = (...m) => Promise.resolve(ed25519.etc.sha512Sync(...m));

// API Configuration - Use environment configuration
const API_BASE_URL = ENV.get('SECURESPHERE_API_BASE_URL') || 'https://api.example.com/v1';

class SecureAuthenticator {
  constructor() {
    this.currentSession = null;
  }

  // Generate UUID for user identification
  generateUUID() {
    const timestamp = Date.now().toString(36);
    const randomPart = crypto.getRandomValues(new Uint8Array(8));
    const randomHex = Array.from(randomPart, byte => byte.toString(16).padStart(2, '0')).join('');
    return `user_${timestamp}_${randomHex}`;
  }

  // Extract public key from seed phrase
  async extractPublicKey(seedPhrase) {
    try {
      // Validate seed phrase first
      if (!bip39.validateMnemonic(seedPhrase)) {
        throw new Error('Invalid seed phrase');
      }

      // Convert seed phrase to seed bytes
      const seed = await bip39.mnemonicToSeed(seedPhrase);
      
      // Use first 32 bytes for Ed25519 key generation
      const privateKeyBytes = seed.slice(0, 32);
      
      // Generate Ed25519 key pair
      const publicKeyBytes = await ed25519.getPublicKey(privateKeyBytes);
      
      // Return hex-encoded public key
      return {
        publicKey: Array.from(publicKeyBytes, byte => byte.toString(16).padStart(2, '0')).join(''),
        privateKeyBytes // Keep for signing if needed
      };
    } catch (error) {
      console.error('Error extracting public key:', error);
      throw new Error(`Failed to extract public key: ${error.message}`);
    }
  }

  // Sign a message with private key for authentication
  async signMessage(message, privateKeyBytes) {
    try {
      const messageBytes = new TextEncoder().encode(message);
      const signature = await ed25519.sign(messageBytes, privateKeyBytes);
      return Array.from(signature, byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Error signing message:', error);
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  }

  // Register new user with API
  async registerUser(seedPhrase) {
    try {
      const uuid = this.generateUUID();
      const { publicKey, privateKeyBytes } = await this.extractPublicKey(seedPhrase);
      
      // Create registration payload
      const timestamp = Date.now();
      const registrationData = {
        uuid,
        publicKey,
        timestamp
      };

      // Sign the registration data for verification
      const messageToSign = `${uuid}:${publicKey}:${timestamp}`;
      const signature = await this.signMessage(messageToSign, privateKeyBytes);
      
      const payload = {
        ...registrationData,
        signature
      };

       + '...' });

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Registration failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Store user credentials locally (without seed phrase)
      await chrome.storage.local.set({
        userUUID: uuid,
        publicKey: publicKey,
        isRegistered: true,
        registrationTimestamp: timestamp,
        serverResponse: result
      });

      
      return {
        success: true,
        uuid,
        publicKey,
        serverData: result
      };

    } catch (error) {
      console.error('Registration error:', error);
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  // Verify user with API using public key
  async verifyUser(seedPhrase) {
    try {
      const { publicKey, privateKeyBytes } = await this.extractPublicKey(seedPhrase);
      
      // Check if user exists locally first
      const localData = await chrome.storage.local.get(['userUUID', 'publicKey', 'isRegistered']);
      
      if (localData.publicKey && localData.publicKey !== publicKey) {
        throw new Error('Seed phrase does not match registered account');
      }

      // Create verification payload
      const timestamp = Date.now();
      const verificationData = {
        publicKey,
        timestamp
      };

      // Sign the verification data
      const messageToSign = `verify:${publicKey}:${timestamp}`;
      const signature = await this.signMessage(messageToSign, privateKeyBytes);

      const payload = {
        ...verificationData,
        signature
      };

       + '...' });

      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 404) {
          throw new Error('Account not found. Please register first.');
        }
        throw new Error(errorData.message || `Verification failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Update local storage with verification
      await chrome.storage.local.set({
        userUUID: result.uuid || localData.userUUID,
        publicKey: publicKey,
        isVerified: true,
        lastLoginTimestamp: timestamp,
        serverResponse: result
      });

      
      return {
        success: true,
        uuid: result.uuid,
        publicKey,
        serverData: result
      };

    } catch (error) {
      console.error('Verification error:', error);
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  // Check if user is already registered locally
  async isUserRegistered() {
    try {
      const data = await chrome.storage.local.get(['isRegistered', 'userUUID', 'publicKey']);
      return {
        registered: !!data.isRegistered,
        uuid: data.userUUID,
        publicKey: data.publicKey
      };
    } catch (error) {
      console.error('Error checking registration status:', error);
      return { registered: false };
    }
  }

  // Get current session info
  async getSessionInfo() {
    try {
      const data = await chrome.storage.local.get([
        'userUUID', 
        'publicKey', 
        'isRegistered', 
        'isVerified',
        'lastLoginTimestamp'
      ]);

      return {
        uuid: data.userUUID,
        publicKey: data.publicKey,
        isRegistered: !!data.isRegistered,
        isVerified: !!data.isVerified,
        lastLogin: data.lastLoginTimestamp
      };
    } catch (error) {
      console.error('Error getting session info:', error);
      return null;
    }
  }

  // Clear session data (logout)
  async clearSession() {
    try {
      await chrome.storage.local.remove([
        'isVerified',
        'lastLoginTimestamp',
        'serverResponse'
      ]);
      
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  // Reset all auth data (for testing or account reset)
  async resetAuthData() {
    try {
      await chrome.storage.local.remove([
        'userUUID',
        'publicKey', 
        'isRegistered',
        'isVerified',
        'registrationTimestamp',
        'lastLoginTimestamp',
        'serverResponse'
      ]);
      
    } catch (error) {
      console.error('Error resetting auth data:', error);
    }
  }
}

// Export singleton instance
export const secureAuth = new SecureAuthenticator();

// Export class for testing
export { SecureAuthenticator }; 
