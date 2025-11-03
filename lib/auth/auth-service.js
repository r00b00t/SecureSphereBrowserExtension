// Authentication Service
// Handles authentication operations, session management, and security

import * as bip39 from 'bip39';
import { encryptData, decryptData } from '../password/index.js';
import { 
  generateKeyFromSeedBytes,
  generateStorageEncryptionKey,
  secureStorageSet,
  secureStorageGet,
  migrateToEncryptedStorage,
  verifyStorageEncryption
} from '../key/index.js';
import { secureAuth } from './secure-auth.js';
import { ENV, getSessionConfig } from '../config/environment.js';

export class AuthService {
  constructor() {
    this.currentUserSession = null;
    this.currentStorageKey = null;
    this.sessionConfig = getSessionConfig();
    this.sessionTimeout = this.sessionConfig.defaultTimeout * 60 * 1000; // Convert to milliseconds
    this.isDebugEnabled = ENV.isDebugEnabled();
  }

  /**
   * Initialize storage encryption system
   * @param {string} seedPhrase - User's seed phrase
   * @returns {Promise<boolean>} Success status
   */
  async initializeStorageEncryption(seedPhrase) {
    try {
      if (this.isDebugEnabled) {
        
      }
      
      // Generate storage encryption key from seed phrase
      this.currentStorageKey = await generateStorageEncryptionKey(seedPhrase);
      
      // Verify encryption system is working
      const verificationResult = await verifyStorageEncryption(this.currentStorageKey);
      if (!verificationResult) {
        throw new Error('Storage encryption verification failed');
      }
      
      // Migrate existing data to encrypted format
      await migrateToEncryptedStorage(this.currentStorageKey);
      
      if (this.isDebugEnabled) {
        
      }
      
      return true;
    } catch (error) {
      console.error('❌ [AUTH] Failed to initialize storage encryption:', error);
      this.currentStorageKey = null;
      throw error;
    }
  }

  /**
   * Get secure storage wrapper
   * @returns {Object} Secure storage interface
   */
  getSecureStorage() {
    return {
      set: async (items) => {
        if (!this.currentStorageKey) {
          
          return new Promise((resolve, reject) => {
            chrome.storage.local.set(items, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          });
        }
        return secureStorageSet(items, this.currentStorageKey);
      },
      
      get: async (keys) => {
        if (!this.currentStorageKey) {
          
          return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (result) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(result);
              }
            });
          });
        }
        return secureStorageGet(keys, this.currentStorageKey);
      }
    };
  }

  /**
   * Validate seed phrase using BIP39 standards
   * @param {string} seedPhrase - The seed phrase to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  validateSeedPhrase(seedPhrase) {
    try {
      if (!seedPhrase || typeof seedPhrase !== 'string') {
        return false;
      }
      
      // Validate using BIP39 standard
      return bip39.validateMnemonic(seedPhrase.trim());
    } catch (error) {
      console.error('❌ [AUTH-SERVICE] Seed phrase validation error:', error);
      return false;
    }
  }

  /**
   * Store PIN code securely
   * @param {string} pin - PIN to store
   * @param {string} seedPhrase - User's seed phrase
   * @returns {Promise<Object>} Result object with success status
   */
  async storePin(pin, seedPhrase) {
    try {
      // Initialize anti-stealer protection if not already done
      if (!this.currentStorageKey) {
        
        await this.initializeStorageEncryption(seedPhrase);
      }

      const seed = await bip39.mnemonicToSeed(seedPhrase);
      const { encryptionKey: key } = await generateKeyFromSeedBytes(seed);
      
      // Encrypt PIN with seed-derived key
      const encryptedPin = await encryptData(pin, key);
      
      // Create PIN-derived key for encrypting the seed phrase
      const encoder = new TextEncoder();
      const pinKeyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pin.padEnd(32, '0')),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      
      const pinDerivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('SecureSphere'),
          iterations: ENV.get('ENCRYPTION_ITERATIONS'),
          hash: 'SHA-256'
        },
        pinKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
      
      // Encrypt seed phrase with PIN-derived key
      const encryptedSeed = await encryptData(seedPhrase, pinDerivedKey);
      
      const secureStorage = this.getSecureStorage();
      await secureStorage.set({ 
        pinCode: encryptedPin,
        encryptedSeedPhrase: encryptedSeed,
        storedSeedPhrase: seedPhrase,
        hasSeedPhrase: true
      });
      
      
      return { success: true };
    } catch (error) {
      console.error('❌ [AUTH] Error storing PIN code:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify PIN code
   * @param {string} pin - PIN to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifyPin(pin) {
    try {
      const secureStorage = this.getSecureStorage();
      const result = await secureStorage.get(['pinCode', 'encryptedSeedPhrase']);
      const { pinCode, encryptedSeedPhrase } = result;
      
      if (!pinCode || !encryptedSeedPhrase) {
        return { verified: false, error: 'PIN not set or seed phrase not found' };
      }

      // First decrypt the seed phrase using a temporary key derived from PIN
      const encoder = new TextEncoder();
      const pinKeyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pin.padEnd(32, '0')),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      
      const tempKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('SecureSphere'),
          iterations: ENV.get('ENCRYPTION_ITERATIONS'),
          hash: 'SHA-256'
        },
        pinKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      let seedPhrase;
      try {
        seedPhrase = await decryptData(encryptedSeedPhrase, tempKey);
      } catch (decryptError) {
        return { verified: false, error: 'Invalid PIN' };
      }

      // Initialize storage encryption with recovered seed phrase
      if (!this.currentStorageKey) {
        await this.initializeStorageEncryption(seedPhrase);
      }

      // Now verify the PIN by encrypting it with the seed-derived key
      const seed = await bip39.mnemonicToSeed(seedPhrase);
      const { encryptionKey: key } = await generateKeyFromSeedBytes(seed);
      
      const decryptedPin = await decryptData(pinCode, key);
      
      if (decryptedPin === pin) {
        
        
        // Create user session for successful PIN verification
        this.createUserSession(seedPhrase);
        
        return { verified: true, seedPhrase };
      } else {
        return { verified: false, error: 'Invalid PIN' };
      }
    } catch (error) {
      console.error('❌ [AUTH] Error verifying PIN:', error);
      return { verified: false, error: error.message };
    }
  }

  /**
   * Verify seed phrase login
   * @param {string} seedPhrase - Seed phrase to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifySeedPhraseLogin(seedPhrase) {
    try {
      // Validate seed phrase
      if (!this.validateSeedPhrase(seedPhrase)) {
        return { success: false, error: 'Invalid seed phrase' };
      }

      // Initialize storage encryption if needed
      if (!this.currentStorageKey) {
        await this.initializeStorageEncryption(seedPhrase);
      }

      // Create user session for successful seed phrase login
      this.createUserSession(seedPhrase);

      
      return { success: true, seedPhrase };
    } catch (error) {
      console.error('❌ [AUTH] Error verifying seed phrase login:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user is logged in
   * @returns {Promise<Object>} Login status information
   */
  async checkLoginStatus() {
    try {
      // Check if user has a valid active session
      const hasValidSession = this.isSessionValid();
      
      // Use secure storage if available, otherwise fallback to regular storage
      let result;
      const secureStorage = this.getSecureStorage();
      
      result = await secureStorage.get([
        'hasSeedPhrase', 
        'encryptedSeedPhrase', 
        'storedSeedPhrase', 
        'firstTimeSetup',
        'pinCode',
        'credentials'
      ]);
      
      const { 
        hasSeedPhrase, 
        encryptedSeedPhrase, 
        storedSeedPhrase, 
        firstTimeSetup,
        pinCode,
        credentials
      } = result;

      if (this.isDebugEnabled) {
        
      }

      if (firstTimeSetup === true) {
        return { 
          isLoggedIn: false,
          requiresPin: false,
          firstTimeSetup: true,
          hasStoredCredentials: false,
          hasPinSetup: false
        };
      }

      // Check if user has PIN setup
      const hasPinSetup = !!(pinCode && encryptedSeedPhrase);
      
      // Check if user has any stored credentials
      const hasStoredCredentials = !!(credentials || hasSeedPhrase || storedSeedPhrase);
      
      // User is logged in if they have a valid session
      const isLoggedIn = hasValidSession;
      
      return { 
        isLoggedIn,
        requiresPin: hasPinSetup,
        firstTimeSetup: false,
        hasStoredCredentials,
        hasPinSetup
      };
    } catch (error) {
      console.error('❌ [AUTH] Error checking login status:', error);
      return { 
        isLoggedIn: false, 
        requiresPin: false, 
        firstTimeSetup: false,
        hasStoredCredentials: false,
        hasPinSetup: false
      };
    }
  }

  /**
   * Change PIN functionality
   * @param {string} currentPin - Current PIN
   * @param {string} newPin - New PIN
   * @returns {Promise<Object>} Change result
   */
  async changePin(currentPin, newPin) {
    try {
      
      
      // First verify current PIN
      const verifyResult = await this.verifyPin(currentPin);
      if (!verifyResult.verified) {
        return { success: false, error: 'Current PIN is incorrect' };
      }
      
      // Get seed phrase from verified session
      const seedPhrase = verifyResult.seedPhrase;
      
      // Store new PIN with the same seed phrase
      const storeResult = await this.storePin(newPin, seedPhrase);
      if (!storeResult.success) {
        return { success: false, error: 'Failed to store new PIN' };
      }
      
      
      return { success: true };
    } catch (error) {
      console.error('❌ [AUTH] Error changing PIN:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create user session
   * @param {string} seedPhrase - User's seed phrase
   */
  createUserSession(seedPhrase) {
    this.currentUserSession = {
      seedPhrase,
      timestamp: Date.now(),
      isActive: true
    };
    
  }

  /**
   * Check if current session is valid
   * @returns {boolean} Whether session is valid
   */
  isSessionValid() {
    if (!this.currentUserSession || !this.currentUserSession.isActive) {
      return false;
    }
    
    const now = Date.now();
    const sessionAge = now - this.currentUserSession.timestamp;
    
    if (sessionAge > this.sessionTimeout) {
      
      this.clearUserSession();
      return false;
    }
    
    return true;
  }

  /**
   * Refresh user session timestamp
   */
  refreshUserSession() {
    if (this.currentUserSession && this.currentUserSession.isActive) {
      this.currentUserSession.timestamp = Date.now();
      
    }
  }

  /**
   * Clear user session
   */
  clearUserSession() {
    this.currentUserSession = null;
    this.currentStorageKey = null;
    
  }

  /**
   * Logout user
   * @returns {Promise<Object>} Logout result
   */
  async logout() {
    try {
      // Clear user session
      this.clearUserSession();
      
      // Clear external authentication session
      await secureAuth.clearSession();
      
      return { success: true };
    } catch (error) {
      console.error('❌ [AUTH] Error during logout:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update session timeout
   * @param {number} timeoutMinutes - New timeout in minutes
   * @returns {Promise<Object>} Update result
   */
  async updateSessionTimeout(timeoutMinutes) {
    try {
      this.sessionTimeout = timeoutMinutes * 60 * 1000; // Convert minutes to milliseconds
      
      // You might want to save this to settings as well
      
      return { success: true };
    } catch (error) {
      console.error('❌ [AUTH] Error updating session timeout:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current session timeout in minutes
   * @returns {number} Session timeout in minutes
   */
  getSessionTimeout() {
    return Math.floor(this.sessionTimeout / (60 * 1000));
  }

  /**
   * Check if there's an active session
   * @returns {boolean} Whether there's an active session
   */
  hasActiveSession() {
    return this.currentUserSession && this.currentUserSession.isActive;
  }

  /**
   * Get current user session info
   * @returns {Object|null} Current session information
   */
  getCurrentSession() {
    if (!this.currentUserSession || !this.isSessionValid()) {
      return null;
    }
    
    return {
      seedPhrase: this.currentUserSession.seedPhrase,
      timestamp: this.currentUserSession.timestamp,
      isActive: this.currentUserSession.isActive,
      timeRemaining: this.sessionTimeout - (Date.now() - this.currentUserSession.timestamp)
    };
  }
}

// Create and export singleton instance
export const authService = new AuthService(); 
