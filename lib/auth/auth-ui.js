// Authentication UI Module
// Handles authentication UI components and user interactions

import { ENV } from '../config/environment.js';

export class AuthUI {
  constructor() {
    this.currentSeedPhrase = '';
    this.currentUserSession = null;
    this.isDebugEnabled = ENV.isDebugEnabled();
  }

  /**
   * Initialize authentication UI components
   */
  initializeAuthUI() {
    this.setupAuthEventListeners();
    
  }

  /**
   * Setup authentication-related event listeners
   */
  setupAuthEventListeners() {
    // New user flow
    const generateNewSeedBtn = document.getElementById('generateNewSeed');
    if (generateNewSeedBtn) {
      generateNewSeedBtn.addEventListener('click', () => this.handleGenerateNewSeed());
    }

    const copySeedPhraseBtn = document.getElementById('copySeedPhrase');
    if (copySeedPhraseBtn) {
      copySeedPhraseBtn.addEventListener('click', () => this.handleCopySeedPhrase());
    }

    const createWalletBtn = document.getElementById('createWalletBtn');
    if (createWalletBtn) {
      createWalletBtn.addEventListener('click', () => this.handleCreateWallet());
    }

    const skipToLoginBtn = document.getElementById('skipToLogin');
    if (skipToLoginBtn) {
      skipToLoginBtn.addEventListener('click', () => this.handleSkipToLogin());
    }

    const continueSetupBtn = document.getElementById('continueSetup');
    if (continueSetupBtn) {
      continueSetupBtn.addEventListener('click', () => this.handleContinueSetup());
    }

    // Returning user flow
    const loginWithPinBtn = document.getElementById('loginWithPinBtn');
    if (loginWithPinBtn) {
      loginWithPinBtn.addEventListener('click', () => this.handlePinLogin());
    }

    const loginWithSeedBtn = document.getElementById('loginWithSeedBtn');
    if (loginWithSeedBtn) {
      loginWithSeedBtn.addEventListener('click', () => this.handleSeedPhraseLogin());
    }

    const showSeedPhraseLoginBtn = document.getElementById('showSeedPhraseLogin');
    if (showSeedPhraseLoginBtn) {
      showSeedPhraseLoginBtn.addEventListener('click', () => this.showSeedPhraseLogin());
    }

    const showPinLoginBtn = document.getElementById('showPinLogin');
    if (showPinLoginBtn) {
      showPinLoginBtn.addEventListener('click', () => this.showPinLogin());
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Auto-show seed confirmation when user starts typing
    const confirmSeedInput = document.getElementById('confirmSeedInput');
    if (confirmSeedInput) {
      confirmSeedInput.addEventListener('input', () => this.handleSeedConfirmation());
    }

    // PIN input validation
    this.setupPinInputValidation();

    
  }

  /**
   * Setup PIN input validation (numbers only)
   */
  setupPinInputValidation() {
    const pinInputIds = ['newUserPin', 'confirmNewUserPin', 'loginPin', 'currentPin', 'newPin', 'confirmNewPin'];
    
    pinInputIds.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', (event) => this.validatePinInput(event));
      }
    });
  }

  /**
   * Validate PIN input to only allow numbers
   * @param {Event} event - Input event
   */
  validatePinInput(event) {
    const input = event.target;
    input.value = input.value.replace(/[^0-9]/g, '');
  }

  /**
   * Generate new seed phrase
   */
  async handleGenerateNewSeed() {
    try {
      this.showButtonLoading('generateNewSeed', 'Generating secure seed phrase...');
      
      const response = await chrome.runtime.sendMessage({ type: 'GENERATE_SEED' });
      
      if (response.error) {
        throw new Error(response.error);
      }

      this.currentSeedPhrase = response.seedPhrase;
      document.getElementById('generatedSeedPhrase').textContent = this.currentSeedPhrase;
      document.getElementById('copySeedPhrase').style.display = 'block';
      document.getElementById('quickAccessOption').style.display = 'block';
      
      this.showMessage('Secure seed phrase generated! You can now choose how to proceed.', 'success');
    } catch (error) {
      console.error('❌ [AUTH-UI] Error generating seed phrase:', error);
      this.showMessage('Failed to generate seed phrase: ' + error.message, 'error');
    } finally {
      this.hideButtonLoading('generateNewSeed', 'Generate New Seed Phrase');
    }
  }

  /**
   * Copy seed phrase to clipboard
   */
  async handleCopySeedPhrase() {
    try {
      await navigator.clipboard.writeText(this.currentSeedPhrase);
      this.showMessage('Seed phrase copied to clipboard!', 'success');
    } catch (error) {
      console.error('❌ [AUTH-UI] Failed to copy to clipboard:', error);
      this.showMessage('Failed to copy seed phrase. Please copy it manually.', 'error');
    }
  }

  /**
   * Handle seed phrase confirmation input
   */
  handleSeedConfirmation() {
    const confirmInput = document.getElementById('confirmSeedInput');
    const confirmationStep = document.getElementById('seedConfirmationStep');
    
    if (confirmInput.value.trim().length > 0 && this.currentSeedPhrase) {
      confirmationStep.style.display = 'block';
    }
  }

  /**
   * Handle create wallet
   */
  async handleCreateWallet() {
    try {
      const confirmSeed = document.getElementById('confirmSeedInput').value.trim();
      const pin = document.getElementById('newUserPin').value;
      const confirmPin = document.getElementById('confirmNewUserPin').value;

      // Validation
      if (!this.currentSeedPhrase) {
        throw new Error('Please generate a seed phrase first');
      }

      if (confirmSeed !== this.currentSeedPhrase) {
        throw new Error('Seed phrase confirmation does not match. Please check and try again.');
      }

      if (!pin || pin.length < 4) {
        throw new Error('PIN must be at least 4 digits');
      }

      if (pin !== confirmPin) {
        throw new Error('PIN confirmation does not match');
      }

      if (!/^\d+$/.test(pin)) {
        throw new Error('PIN must contain only numbers');
      }

      this.showButtonLoading('createWalletBtn', 'Creating secure wallet...', 'createWalletLoading', 'createWalletText');

      // Store PIN and seed phrase
      const storeResponse = await chrome.runtime.sendMessage({
        type: 'STORE_PIN',
        pin: pin,
        seedPhrase: this.currentSeedPhrase
      });

      if (!storeResponse.success) {
        throw new Error(storeResponse.error || 'Failed to store wallet data');
      }

      // Register with API (optional)
      try {
        await chrome.runtime.sendMessage({
          type: 'REGISTER_USER',
          seedPhrase: this.currentSeedPhrase
        });
      } catch (apiError) {
        :', apiError);
      }

      this.showMessage('Wallet created successfully! You can now access your secure vault.', 'success');
      
      // Automatically login after successful creation
      setTimeout(() => {
        this.triggerShowMainApp();
      }, 2000);

    } catch (error) {
      console.error('❌ [AUTH-UI] Error creating wallet:', error);
      this.showMessage(error.message, 'error');
    } finally {
      this.hideButtonLoading('createWalletBtn', 'Create My Secure Wallet', 'createWalletLoading', 'createWalletText');
    }
  }

  /**
   * Handle PIN login
   */
  async handlePinLogin() {
    try {
      const pin = document.getElementById('loginPin').value;
      
      if (!pin || pin.length !== 6) {
        this.showMessage('Please enter a valid 6-digit PIN', 'error');
        return;
      }

      this.showButtonLoading('loginWithPinBtn', 'Verifying PIN...', 'pinLoginLoading', 'pinLoginText');

      const response = await chrome.runtime.sendMessage({ 
        type: 'VERIFY_PIN',
        pin: pin
      });

      if (response.verified) {
        this.currentSeedPhrase = response.seedPhrase;
        this.currentUserSession = {
          seedPhrase: response.seedPhrase,
          timestamp: Date.now(),
          isActive: true
        };
        
        this.showMessage('PIN verified successfully!', 'success');
        
        // Small delay to show success message before transitioning
        setTimeout(() => {
          this.triggerShowMainApp();
        }, 1000);
      } else {
        this.showMessage(response.error || 'Invalid PIN', 'error');
      }
    } catch (error) {
      console.error('❌ [AUTH-UI] Error during PIN login:', error);
      this.showMessage('Login failed: ' + error.message, 'error');
    } finally {
      this.hideButtonLoading('loginWithPinBtn', 'Access Vault', 'pinLoginLoading', 'pinLoginText');
    }
  }

  /**
   * Handle seed phrase login
   */
  async handleSeedPhraseLogin() {
    try {
      const seedPhrase = document.getElementById('loginSeedPhrase').value.trim();
      
      if (!seedPhrase) {
        this.showMessage('Please enter your seed phrase', 'error');
        return;
      }

      this.showButtonLoading('loginWithSeedBtn', 'Verifying seed phrase...', 'seedLoginLoading', 'seedLoginText');

      // Verify seed phrase and create session
      const response = await chrome.runtime.sendMessage({ 
        type: 'VERIFY_SEED_PHRASE_LOGIN',
        seedPhrase
      });

      if (response.success) {
        this.currentSeedPhrase = response.seedPhrase;
        this.currentUserSession = {
          seedPhrase: response.seedPhrase,
          timestamp: Date.now(),
          isActive: true
        };
        
        this.showMessage('Seed phrase verified successfully!', 'success');
        
        // Small delay to show success message before transitioning
        setTimeout(() => {
          this.triggerShowMainApp();
        }, 1000);
      } else {
        this.showMessage(response.error || 'Invalid seed phrase', 'error');
      }
    } catch (error) {
      console.error('❌ [AUTH-UI] Error during seed phrase login:', error);
      this.showMessage('Login failed: ' + error.message, 'error');
    } finally {
      this.hideButtonLoading('loginWithSeedBtn', 'Access Vault', 'seedLoginLoading', 'seedLoginText');
    }
  }

  /**
   * Handle logout
   */
  async handleLogout() {
    try {
      // Clear local session data
      this.currentSeedPhrase = '';
      this.currentUserSession = null;
      
      // Clear session in background script
      await chrome.runtime.sendMessage({ type: 'LOGOUT' });
      
      this.showMessage('Logged out successfully', 'success');
      
      // Return to appropriate screen based on user setup
      const loginStatus = await this.checkLoginStatus();
      if (loginStatus.requiresPin) {
        this.triggerShowReturningUserFormWithPin();
      } else if (loginStatus.hasStoredCredentials) {
        this.triggerShowReturningUserFormWithSeedPhrase();
      } else {
        this.triggerShowWelcomeScreen();
      }
      
    } catch (error) {
      console.error('❌ [AUTH-UI] Error during logout:', error);
      this.showMessage('Logout failed: ' + error.message, 'error');
    }
  }

  /**
   * Handle skip setup - immediate login with seed phrase
   */
  async handleSkipToLogin() {
    try {
      if (!this.currentSeedPhrase) {
        throw new Error('No seed phrase generated');
      }

      this.showMessage('Logging in with your new seed phrase...', 'success');
      
      // Immediately login to main app without PIN setup
      setTimeout(() => {
        this.triggerShowMainApp();
      }, 1500);

    } catch (error) {
      console.error('❌ [AUTH-UI] Skip to login error:', error);
      this.showMessage(error.message, 'error');
    }
  }

  /**
   * Handle continue setup - show PIN configuration
   */
  handleContinueSetup() {
    document.getElementById('quickAccessOption').style.display = 'none';
    document.getElementById('seedConfirmationStep').style.display = 'block';
    
    // Pre-fill the confirmation if user wants to continue with full setup
    const confirmInput = document.getElementById('confirmSeedInput');
    if (confirmInput && this.currentSeedPhrase) {
      confirmInput.value = this.currentSeedPhrase;
    }
    
    this.showMessage('Complete the setup to add PIN protection to your wallet.', 'success');
  }

  /**
   * Show PIN login method
   */
  showPinLogin() {
    document.getElementById('pinLoginStep').style.display = 'block';
    document.getElementById('seedPhraseLoginStep').style.display = 'none';
  }

  /**
   * Show seed phrase login method
   */
  showSeedPhraseLogin() {
    document.getElementById('pinLoginStep').style.display = 'none';
    document.getElementById('seedPhraseLoginStep').style.display = 'block';
  }

  /**
   * Check login status with background script
   */
  async checkLoginStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_LOGIN_STATUS' });
      return response;
    } catch (error) {
      console.error('❌ [AUTH-UI] Error checking login status:', error);
      return { isLoggedIn: false, requiresPin: false, firstTimeSetup: false };
    }
  }

  /**
   * Show loading state on button
   * @param {string} buttonId - Button element ID
   * @param {string} message - Loading message
   * @param {string} loadingId - Loading element ID (optional)
   * @param {string} textId - Text element ID (optional)
   */
  showButtonLoading(buttonId, message, loadingId = null, textId = null) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.disabled = true;
      if (loadingId && textId) {
        const loadingElement = document.getElementById(loadingId);
        const textElement = document.getElementById(textId);
        if (loadingElement) loadingElement.style.display = 'inline';
        if (textElement) textElement.style.display = 'none';
      } else {
        button.innerHTML = `<span class="loading-spinner"></span> ${message}`;
      }
    }
  }

  /**
   * Hide loading state on button
   * @param {string} buttonId - Button element ID
   * @param {string} originalText - Original button text
   * @param {string} loadingId - Loading element ID (optional)
   * @param {string} textId - Text element ID (optional)
   */
  hideButtonLoading(buttonId, originalText, loadingId = null, textId = null) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.disabled = false;
      if (loadingId && textId) {
        const loadingElement = document.getElementById(loadingId);
        const textElement = document.getElementById(textId);
        if (loadingElement) loadingElement.style.display = 'none';
        if (textElement) textElement.style.display = 'inline';
      } else {
        button.textContent = originalText;
      }
    }
  }

  /**
   * Show message to user (needs to be provided by the parent context)
   * @param {string} message - Message to show
   * @param {string} type - Message type (success, error, warning, info)
   */
  showMessage(message, type = 'info') {
    // This should be provided by the parent context that imports this module
    if (typeof window.showMessage === 'function') {
      window.showMessage(message, type);
    } else {
      }] ${message}`);
    }
  }

  /**
   * Trigger navigation to main app (needs to be provided by parent context)
   */
  triggerShowMainApp() {
    if (typeof window.showMainApp === 'function') {
      window.showMainApp();
    } else {
      
    }
  }

  /**
   * Trigger navigation to welcome screen
   */
  triggerShowWelcomeScreen() {
    if (typeof window.showWelcomeScreen === 'function') {
      window.showWelcomeScreen();
    } else {
      
    }
  }

  /**
   * Trigger navigation to returning user form with PIN
   */
  triggerShowReturningUserFormWithPin() {
    if (typeof window.showReturningUserFormWithPin === 'function') {
      window.showReturningUserFormWithPin();
    } else {
      
    }
  }

  /**
   * Trigger navigation to returning user form with seed phrase
   */
  triggerShowReturningUserFormWithSeedPhrase() {
    if (typeof window.showReturningUserFormWithSeedPhrase === 'function') {
      window.showReturningUserFormWithSeedPhrase();
    } else {
      
    }
  }

  /**
   * Get current authentication state
   * @returns {Object} Current authentication state
   */
  getCurrentAuthState() {
    return {
      currentSeedPhrase: this.currentSeedPhrase,
      currentUserSession: this.currentUserSession,
      hasActiveSession: !!(this.currentUserSession && this.currentUserSession.isActive)
    };
  }

  /**
   * Set authentication state (for parent context integration)
   * @param {string} seedPhrase - Current seed phrase
   * @param {Object} userSession - Current user session
   */
  setAuthState(seedPhrase, userSession) {
    this.currentSeedPhrase = seedPhrase;
    this.currentUserSession = userSession;
  }
}

// Create and export singleton instance
export const authUI = new AuthUI(); 
