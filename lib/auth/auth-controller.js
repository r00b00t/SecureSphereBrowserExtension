// Authentication Controller
// Handles background authentication logic and message handling

import { authService } from './auth-service.js';
import { ENV } from '../config/environment.js';
import * as bip39 from 'bip39';

export class AuthController {
  constructor() {
    this.setupMessageHandlers();
    this.isDebugEnabled = ENV.isDebugEnabled();
    
  }

  /**
   * Set up chrome runtime message handlers for authentication
   */
  setupMessageHandlers() {
    
  }

  /**
   * Handle PIN storage request
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   */
  async handleStorePin(message, sendResponse) {
    try {
      

      if (!message.pin || !message.seedPhrase) {
        sendResponse({ success: false, error: 'PIN and seed phrase are required' });
        return;
      }

      const result = await authService.storePin(message.pin, message.seedPhrase);
      sendResponse(result);
    } catch (error) {
      console.error('❌ [AUTH] Error storing PIN:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle PIN verification request
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   */
  async handleVerifyPin(message, sendResponse) {
    try {
      

      if (!message.pin) {
        sendResponse({ verified: false, error: 'PIN is required' });
        return;
      }

      const result = await authService.verifyPin(message.pin);
      sendResponse(result);
    } catch (error) {
      console.error('❌ [AUTH] Error verifying PIN:', error);
      sendResponse({ verified: false, error: error.message });
    }
  }

  /**
   * Handle seed phrase login verification request
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   */
  async handleVerifySeedPhraseLogin(message, sendResponse) {
    try {
      

      if (!message.seedPhrase) {
        sendResponse({ success: false, error: 'Seed phrase is required' });
        return;
      }

      const result = await authService.verifySeedPhraseLogin(message.seedPhrase);
      sendResponse(result);
    } catch (error) {
      console.error('❌ [AUTH] Error verifying seed phrase login:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle login status check request
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   */
  async handleCheckLoginStatus(message, sendResponse) {
    try {
      

      const result = await authService.checkLoginStatus();
      sendResponse(result);
    } catch (error) {
      console.error('❌ [AUTH] Error checking login status:', error);
      sendResponse({ 
        isLoggedIn: false, 
        requiresPin: false, 
        firstTimeSetup: false,
        hasStoredCredentials: false,
        hasPinSetup: false,
        error: error.message
      });
    }
  }

  /**
   * Handle logout request
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   */
  async handleLogout(message, sendResponse) {
    try {
      

      const result = await authService.logout();
      sendResponse(result);
    } catch (error) {
      console.error('❌ [AUTH] Error during logout:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle seed phrase generation request
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   */
  async handleGenerateSeed(message, sendResponse) {
    try {
      

      // Generate a new 12-word seed phrase
      const seedPhrase = bip39.generateMnemonic(128); // 128 bits = 12 words
      
      
      sendResponse({ seedPhrase });
    } catch (error) {
      console.error('❌ [AUTH] Error generating seed phrase:', error);
      sendResponse({ error: error.message });
    }
  }

  /**
   * Handle PIN change request
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   */
  async handleChangePin(message, sendResponse) {
    try {
      

      if (!message.currentPin || !message.newPin) {
        sendResponse({ success: false, error: 'Current PIN and new PIN are required' });
        return;
      }

      const result = await authService.changePin(message.currentPin, message.newPin);
      sendResponse(result);
    } catch (error) {
      console.error('❌ [AUTH] Error changing PIN:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle user registration request (with external API)
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   */
  async handleRegisterUser(message, sendResponse) {
    try {
      

      if (!message.seedPhrase) {
        sendResponse({ success: false, error: 'Seed phrase is required' });
        return;
      }

      // Get API endpoint from environment
      const apiEndpoint = ENV.get('API_ENDPOINT');
      
      if (!apiEndpoint) {
        
        sendResponse({ success: true, message: 'Registration skipped - no API endpoint configured' });
        return;
      }

      // Generate wallet address from seed phrase for registration
      const seed = await bip39.mnemonicToSeed(message.seedPhrase);
      const walletAddress = await this.generateWalletAddressFromSeed(seed);

      // Register with external API
      const registrationData = {
        walletAddress,
        timestamp: Date.now(),
        version: '1.0.0'
      };

      const response = await fetch(`${apiEndpoint}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': '1.0.0'
        },
        body: JSON.stringify(registrationData),
        timeout: ENV.get('API_TIMEOUT')
      });

      if (response.ok) {
        const result = await response.json();
        
        sendResponse({ success: true, userId: result.userId });
      } else {
        const error = await response.text();
        
        sendResponse({ success: true, warning: 'Registration with API failed, but local setup completed' });
      }
    } catch (error) {
      console.error('❌ [AUTH] Error during user registration:', error);
      // Don't fail the entire process if API registration fails
      sendResponse({ success: true, warning: 'Registration with API failed, but local setup completed' });
    }
  }

  /**
   * Handle session refresh request
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   */
  async handleRefreshSession(message, sendResponse) {
    try {
      

      // Check if there's a valid session and refresh it
      if (authService.isSessionValid()) {
        authService.refreshUserSession();
        
        const currentSession = authService.getCurrentSession();
        sendResponse({ 
          success: true, 
          session: currentSession 
        });
      } else {
        sendResponse({ 
          success: false, 
          error: 'No valid session to refresh' 
        });
      }
    } catch (error) {
      console.error('❌ [AUTH] Error refreshing session:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle session timeout update request
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   */
  async handleUpdateSessionTimeout(message, sendResponse) {
    try {
      

      if (!message.timeoutMinutes || message.timeoutMinutes < 1) {
        sendResponse({ success: false, error: 'Valid timeout in minutes is required' });
        return;
      }

      const result = await authService.updateSessionTimeout(message.timeoutMinutes);
      sendResponse(result);
    } catch (error) {
      console.error('❌ [AUTH] Error updating session timeout:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle get session info request
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   */
  async handleGetSessionInfo(message, sendResponse) {
    try {
      

      const currentSession = authService.getCurrentSession();
      const sessionTimeout = authService.getSessionTimeout();
      const hasActiveSession = authService.hasActiveSession();

      sendResponse({
        success: true,
        session: currentSession,
        sessionTimeout,
        hasActiveSession,
        isValid: authService.isSessionValid()
      });
    } catch (error) {
      console.error('❌ [AUTH] Error getting session info:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Generate wallet address from seed (simplified implementation)
   * @param {Uint8Array} seed - Seed bytes
   * @returns {Promise<string>} Wallet address
   */
  async generateWalletAddressFromSeed(seed) {
    try {
      // This is a simplified implementation
      // In a real application, you'd use the appropriate crypto library for your blockchain
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', seed.slice(0, 32));
      const hashArray = new Uint8Array(hashBuffer);
      
      // Convert to hex string and take first 20 bytes (40 characters) as address
      const address = '0x' + Array.from(hashArray.slice(0, 20))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      return address;
    } catch (error) {
      console.error('❌ [AUTH] Error generating wallet address:', error);
      // Return a deterministic fallback address
      return '0x' + Array.from(seed.slice(0, 20))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  }

  /**
   * Handle first time setup completion
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   */
  async handleCompleteFirstTimeSetup(message, sendResponse) {
    try {
      

      const secureStorage = authService.getSecureStorage();
      await secureStorage.set({ firstTimeSetup: false });

      
      sendResponse({ success: true });
    } catch (error) {
      console.error('❌ [AUTH] Error completing first time setup:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Get authentication configuration
   * @returns {Object} Current authentication configuration
   */
  getConfiguration() {
    return {
      sessionTimeout: authService.getSessionTimeout(),
      hasActiveSession: authService.hasActiveSession(),
      encryptionEnabled: true,
      debugLogging: this.isDebugEnabled
    };
  }

  /**
   * Get authentication statistics
   * @returns {Object} Statistics about authentication system
   */
  getStatistics() {
    try {
      const currentSession = authService.getCurrentSession();
      
      return {
        hasActiveSession: authService.hasActiveSession(),
        sessionValid: authService.isSessionValid(),
        sessionTimeout: authService.getSessionTimeout(),
        sessionAge: currentSession ? Date.now() - currentSession.timestamp : null,
        timeRemaining: currentSession ? currentSession.timeRemaining : null
      };
    } catch (error) {
      console.error('❌ [AUTH] Error getting authentication statistics:', error);
      return {
        hasActiveSession: false,
        sessionValid: false,
        sessionTimeout: 0,
        sessionAge: null,
        timeRemaining: null,
        error: error.message
      };
    }
  }

  /**
   * Check if user needs to authenticate
   * @returns {boolean} Whether user needs authentication
   */
  needsAuthentication() {
    return !authService.isSessionValid();
  }

  /**
   * Clear all authentication data (for reset/uninstall)
   * @returns {Promise<Object>} Clear result
   */
  async clearAllAuthData() {
    try {
      

      // Clear session
      authService.clearUserSession();
      
      // Clear stored data
      const secureStorage = authService.getSecureStorage();
      await secureStorage.set({
        pinCode: null,
        encryptedSeedPhrase: null,
        storedSeedPhrase: null,
        hasSeedPhrase: false,
        firstTimeSetup: true
      });

      
      return { success: true };
    } catch (error) {
      console.error('❌ [AUTH] Error clearing authentication data:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export singleton instance
export const authController = new AuthController(); 
