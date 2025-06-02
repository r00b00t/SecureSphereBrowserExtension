import CryptoJS from 'crypto-js';
import * as bip39 from 'bip39';
import { encryptData, decryptData as decryptPasswordData } from './lib/password/index.js';
import { generateKeyFromSeedBytes } from './lib/key/index.js';
import { setupSettingsModal } from './lib/ui/settings.js';
import { authSettings } from './lib/ui/auth-settings.js';
import { API_CONFIG } from './lib/config/api-config.js';
import { breachUI } from './lib/breach/breach-ui.js';
import { ENV, getUIConfig } from './lib/config/environment.js';

// ============================================================================
// NEW MODULAR UI COMPONENTS - REPLACING LEGACY FUNCTIONS
// ============================================================================
import { authUI } from './lib/auth/auth-ui.js';
import { passwordUI } from './lib/password/password-ui.js';

// Application state
let currentSeedPhrase = '';
let currentUserSession = null;
let isLoggedIn = false;

// UI Elements (will be initialized after DOM loads)
let welcomeScreen;
let newUserForm;
let returningUserForm;
let mainApp;

// Get UI configuration
const uiConfig = getUIConfig();




// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
  try {
    const essentialElements = {
      welcomeScreen: document.getElementById('welcomeScreen'),
      newUserForm: document.getElementById('newUserForm'),
      returningUserForm: document.getElementById('returningUserForm'),
      mainApp: document.getElementById('mainApp'),
      newUserCard: document.getElementById('newUserCard'),
      returningUserCard: document.getElementById('returningUserCard')
    };

    const missingElements = Object.entries(essentialElements)
      .filter(([key, element]) => !element)
      .map(([key]) => key);

    if (missingElements.length > 0) {
      console.error('Critical DOM elements missing');
      return;
    }

    try {
      await Promise.all([
        authUI.initialize(),
        passwordUI.initialize(),
        breachUI.initialize()
      ]);
    } catch (uiError) {
      
    }

    await initializeUI();
    setupEventListeners();
    
    passwordUI.setRefreshCallback(() => displayPasswords());
    passwordUI.setWalletRefreshCallback(() => displayWalletSeeds());
    breachUI.setRefreshCallback(() => loadBreachData());

  } catch (error) {
    console.error('Failed to initialize application:', error);
  }
});

async function initializeUI() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_LOGIN_STATUS' });
    const loginStatus = response?.loggedIn || false;
    
    if (!loginStatus) {
      showWelcomeScreen();
    } else {
      const hasPinResponse = await chrome.runtime.sendMessage({ type: 'CHECK_PIN_SET' });
      const hasPin = hasPinResponse?.hasPin || false;
      
      if (hasPin) {
        showReturningUserForm();
      } else {
        showReturningUserForm();
      }
    }
  } catch (error) {
    console.error('Error checking login status:', error);
    showWelcomeScreen();
  }
}

function setupEventListeners() {
  const newUserCard = document.getElementById('newUserCard');
  const returningUserCard = document.getElementById('returningUserCard');

  if (newUserCard) {
    newUserCard.addEventListener('click', () => {
      showNewUserForm();
    });
  } else {
    console.error('❌ newUserCard element not found');
  }

  if (returningUserCard) {
    returningUserCard.addEventListener('click', () => {
      showReturningUserForm();
    });
  } else {
    console.error('❌ returningUserCard element not found');
  }

  // Back buttons
  document.getElementById('backToWelcomeFromNew')?.addEventListener('click', showWelcomeScreen);
  document.getElementById('backToWelcomeFromLogin')?.addEventListener('click', showWelcomeScreen);

  // New user flow
  document.getElementById('generateNewSeed')?.addEventListener('click', generateNewSeedPhrase);
  document.getElementById('copySeedPhrase')?.addEventListener('click', copySeedPhraseToClipboard);
  document.getElementById('createWalletBtn')?.addEventListener('click', handleCreateWallet);
  document.getElementById('skipToLogin')?.addEventListener('click', handleSkipToLogin);
  document.getElementById('continueSetup')?.addEventListener('click', handleContinueSetup);

  // Returning user flow
  document.getElementById('loginWithPinBtn')?.addEventListener('click', handlePinLogin);
  document.getElementById('loginWithSeedBtn')?.addEventListener('click', handleSeedPhraseLogin);
  document.getElementById('showSeedPhraseLogin')?.addEventListener('click', showSeedPhraseLogin);
  document.getElementById('showPinLogin')?.addEventListener('click', showPinLogin);

  // Main app functionality
  document.getElementById('settingsBtn')?.addEventListener('click', () => showSettingsModal());
  document.getElementById('closeSettingsBtn')?.addEventListener('click', () => hideSettingsModal());
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

  // Auto-show seed confirmation when user starts typing in confirm field
  document.getElementById('confirmSeedInput')?.addEventListener('input', handleSeedConfirmation);

  // PIN input validation
  document.getElementById('newUserPin')?.addEventListener('input', validatePinInput);
  document.getElementById('confirmNewUserPin')?.addEventListener('input', validatePinInput);
  document.getElementById('loginPin')?.addEventListener('input', validatePinInput);

  // Setup main app functionality
  setupMainAppEventListeners();
}

// Show welcome screen
function showWelcomeScreen() {
  
  hideAllScreens();
  if (welcomeScreen) {
    welcomeScreen.style.display = 'flex';
    
  } else {
    console.error('Welcome screen element not found');
    showError('UI error: Welcome screen not available');
  }
}

// Show new user form
function showNewUserForm() {
  
  hideAllScreens();
  if (newUserForm) {
    newUserForm.style.display = 'block';
    
    // Reset form state
    const seedDisplay = document.getElementById('generatedSeedPhrase');
    const confirmStep = document.getElementById('seedConfirmationStep');
    const copyBtn = document.getElementById('copySeedPhrase');
    
    if (seedDisplay) seedDisplay.textContent = 'Click "Generate New Seed Phrase" to create your secure wallet';
    if (confirmStep) confirmStep.style.display = 'none';
    if (copyBtn) copyBtn.style.display = 'none';
  } else {
    console.error('New user form element not found');
    showError('UI error: New user form not available');
  }
}

// Show returning user form with PIN login
async function showReturningUserFormWithPin() {
  hideAllScreens();
  if (returningUserForm) {
    returningUserForm.style.display = 'block';
    showPinLogin();
  } else {
    console.error('Returning user form element not found');
    showError('UI error: Login form not available');
  }
}

// Show returning user form with seed phrase login
async function showReturningUserFormWithSeedPhrase() {
  hideAllScreens();
  if (returningUserForm) {
    returningUserForm.style.display = 'block';
    showSeedPhraseLogin();
  } else {
    console.error('Returning user form element not found');
    showError('UI error: Login form not available');
  }
}

// Show returning user form
async function showReturningUserForm() {
  
  hideAllScreens();
  if (returningUserForm) {
    returningUserForm.style.display = 'block';
    
    
    // Check if user has PIN set to determine which login method to show first
    const loginStatus = await checkLoginStatus();
    if (loginStatus.requiresPin) {
      showPinLogin();
    } else {
      showSeedPhraseLogin();
    }
  } else {
    console.error('Returning user form element not found');
    showError('UI error: Login form not available');
  }
}

// Show main application
async function showMainApp() {
  hideAllScreens();
  if (mainApp) {
    mainApp.style.display = 'block';
    isLoggedIn = true;
    
    
    
    // ============================================================================
    // LOAD DATA USING MODULAR COMPONENTS
    // ============================================================================
    
    try {
      // Load credentials using the new password UI module
      
      await passwordUI.refreshCredentials();
      
      // Load breach data using breach UI module
      
      await breachUI.loadRecentBreaches();
      
      // Update authentication state in UI modules
      authUI.setAuthState(currentSeedPhrase, currentUserSession);
      
      
      
    } catch (error) {
      console.error('❌ Error loading main app data:', error);
      showWarning('Some data failed to load. Please try refreshing.');
    }

    // Settings functionality (keep existing implementation)
    setupSettingsEventListeners();

    
  } else {
    console.error('Main app element not found');
    showError('UI error: Main application not available');
  }
}

// Hide all screens
function hideAllScreens() {
  if (welcomeScreen) welcomeScreen.style.display = 'none';
  if (newUserForm) newUserForm.style.display = 'none';
  if (returningUserForm) returningUserForm.style.display = 'none';
  if (mainApp) mainApp.style.display = 'none';
}

// Generate new seed phrase
async function generateNewSeedPhrase() {
  try {
    showLoading('generateNewSeed', 'Generating secure seed phrase...');
    
    const response = await chrome.runtime.sendMessage({ type: 'GENERATE_SEED' });
    
    if (response.error) {
      throw new Error(response.error);
    }

    currentSeedPhrase = response.seedPhrase;
    document.getElementById('generatedSeedPhrase').textContent = currentSeedPhrase;
    document.getElementById('copySeedPhrase').style.display = 'block';
    document.getElementById('quickAccessOption').style.display = 'block';
    
    showSuccess('Secure seed phrase generated! You can now choose how to proceed.');
  } catch (error) {
    console.error('Error generating seed phrase:', error);
    showError('Failed to generate seed phrase: ' + error.message);
  } finally {
    hideLoading('generateNewSeed', 'Generate New Seed Phrase');
  }
}

// Copy seed phrase to clipboard
async function copySeedPhraseToClipboard() {
  try {
    await navigator.clipboard.writeText(currentSeedPhrase);
    showSuccess('Seed phrase copied to clipboard!');
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    showError('Failed to copy seed phrase. Please copy it manually.');
  }
}

// Handle seed phrase confirmation input
function handleSeedConfirmation() {
  const confirmInput = document.getElementById('confirmSeedInput');
  const confirmationStep = document.getElementById('seedConfirmationStep');
  
  if (confirmInput.value.trim().length > 0 && currentSeedPhrase) {
    confirmationStep.style.display = 'block';
  }
}

// Handle create wallet
async function handleCreateWallet() {
  try {
    const confirmSeed = document.getElementById('confirmSeedInput').value.trim();
    const pin = document.getElementById('newUserPin').value;
    const confirmPin = document.getElementById('confirmNewUserPin').value;

    // Validation
    if (!currentSeedPhrase) {
      throw new Error('Please generate a seed phrase first');
    }

    if (confirmSeed !== currentSeedPhrase) {
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

    showLoading('createWalletBtn', 'Creating secure wallet...', 'createWalletLoading', 'createWalletText');

    // Store PIN and seed phrase
    const storeResponse = await chrome.runtime.sendMessage({
      type: 'STORE_PIN',
      pin: pin,
      seedPhrase: currentSeedPhrase
    });

    if (!storeResponse.success) {
      throw new Error(storeResponse.error || 'Failed to store wallet data');
    }

    // Register with API (optional)
    try {
      await chrome.runtime.sendMessage({
        type: 'REGISTER_USER',
        seedPhrase: currentSeedPhrase
      });
    } catch (apiError) {
      :', apiError);
    }

    showSuccess('Wallet created successfully! You can now access your secure vault.');
    
    // Automatically login after successful creation
    setTimeout(async () => {
      await showMainApp();
    }, 2000);

  } catch (error) {
    console.error('Error creating wallet:', error);
    showError(error.message);
  } finally {
    hideLoading('createWalletBtn', 'Create My Secure Wallet', 'createWalletLoading', 'createWalletText');
  }
}

// Handle PIN login
async function handlePinLogin() {
  try {
    const pin = document.getElementById('loginPin').value;
    
    if (!pin || pin.length !== 6) {
      showError('Please enter a valid 6-digit PIN');
      return;
    }

    showLoading('loginWithPinBtn', 'Verifying PIN...', 'pinLoginLoading', 'pinLoginText');

    const response = await chrome.runtime.sendMessage({ 
      type: 'VERIFY_PIN',
      pin: pin
    });

    if (response.verified) {
      currentSeedPhrase = response.seedPhrase;
      currentUserSession = {
        seedPhrase: response.seedPhrase,
        timestamp: Date.now(),
        isActive: true
      };
      
      showSuccess('PIN verified successfully!');
      
      // Small delay to show success message before transitioning
      setTimeout(async () => {
        await showMainApp();
      }, 1000);
    } else {
      showError(response.error || 'Invalid PIN');
    }
  } catch (error) {
    console.error('Error during PIN login:', error);
    showError('Login failed: ' + error.message);
  } finally {
    hideLoading('loginWithPinBtn', 'Access Vault', 'pinLoginLoading', 'pinLoginText');
  }
}

// Handle seed phrase login
async function handleSeedPhraseLogin() {
  try {
    const seedPhrase = document.getElementById('loginSeedPhrase').value.trim();
    
    if (!seedPhrase) {
      showError('Please enter your seed phrase');
      return;
    }

    showLoading('loginWithSeedBtn', 'Verifying seed phrase...', 'seedLoginLoading', 'seedLoginText');

    // Verify seed phrase and create session
    const response = await chrome.runtime.sendMessage({ 
      type: 'VERIFY_SEED_PHRASE_LOGIN',
      seedPhrase
    });

    if (response.success) {
      currentSeedPhrase = response.seedPhrase;
      currentUserSession = {
        seedPhrase: response.seedPhrase,
        timestamp: Date.now(),
        isActive: true
      };
      
      showSuccess('Seed phrase verified successfully!');
      
      // Small delay to show success message before transitioning
      setTimeout(async () => {
        await showMainApp();
      }, 1000);
    } else {
      showError(response.error || 'Invalid seed phrase');
    }
  } catch (error) {
    console.error('Error during seed phrase login:', error);
    showError('Login failed: ' + error.message);
  } finally {
    hideLoading('loginWithSeedBtn', 'Access Vault', 'seedLoginLoading', 'seedLoginText');
  }
}

// Show PIN login method
function showPinLogin() {
  document.getElementById('pinLoginStep').style.display = 'block';
  document.getElementById('seedPhraseLoginStep').style.display = 'none';
}

// Show seed phrase login method
function showSeedPhraseLogin() {
  document.getElementById('pinLoginStep').style.display = 'none';
  document.getElementById('seedPhraseLoginStep').style.display = 'block';
}

// Handle logout
async function handleLogout() {
  try {
    // Clear local session data
    currentSeedPhrase = '';
    currentUserSession = null;
    isLoggedIn = false;
    
    // Clear session in background script
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    
    showSuccess('Logged out successfully');
    
    // Return to appropriate screen based on user setup
    const loginStatus = await checkLoginStatus();
    if (loginStatus.requiresPin) {
      await showReturningUserFormWithPin();
    } else if (loginStatus.hasStoredCredentials) {
      await showReturningUserFormWithSeedPhrase();
    } else {
      showWelcomeScreen();
    }
    
  } catch (error) {
    console.error('Error during logout:', error);
    showError('Logout failed: ' + error.message);
  }
}

// Validate PIN input (numbers only)
function validatePinInput(event) {
  const input = event.target;
  input.value = input.value.replace(/[^0-9]/g, '');
}

// Loading state management
function showLoading(buttonId, message, loadingId = null, textId = null) {
  const button = document.getElementById(buttonId);
  if (button) {
    button.disabled = true;
    if (loadingId && textId) {
      document.getElementById(loadingId).style.display = 'inline';
      document.getElementById(textId).style.display = 'none';
    } else {
      button.innerHTML = `<span class="loading-spinner"></span> ${message}`;
    }
  }
}

function hideLoading(buttonId, originalText, loadingId = null, textId = null) {
  const button = document.getElementById(buttonId);
  if (button) {
    button.disabled = false;
    if (loadingId && textId) {
      document.getElementById(loadingId).style.display = 'none';
      document.getElementById(textId).style.display = 'inline';
    } else {
      button.textContent = originalText;
    }
  }
}

// Message display functions using environment configuration
function showMessage(message, type = 'info', duration = null) {
  const actualDuration = duration || (type === 'error' ? uiConfig.errorMessageDuration : 
                                     type === 'success' ? uiConfig.successMessageDuration : 
                                     type === 'warning' ? uiConfig.warningMessageDuration : 4000);
  
  const container = document.getElementById('messageContainer');
  if (!container) return;

  const messageEl = document.createElement('div');
  messageEl.className = `${type}-message`;
  messageEl.textContent = message;
  
  // Base styles for all messages
  let baseStyles = `
    margin-bottom: 10px;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    animation: slideUp 0.3s ease-out;
    cursor: pointer;
    font-weight: 500;
    border: 2px solid;
  `;
  
  // Type-specific styles with proper contrast
  let typeStyles = '';
  switch(type) {
    case 'success':
      typeStyles = `
        background: rgba(40, 167, 69, 0.15);
        border-color: #28a745;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(40, 167, 69, 0.2);
      `;
      break;
    case 'error':
      typeStyles = `
        background: rgba(220, 53, 69, 0.15);
        border-color: #dc3545;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(220, 53, 69, 0.2);
      `;
      break;
    case 'warning':
      typeStyles = `
        background: rgba(255, 193, 7, 0.15);
        border-color: #ffc107;
        color: #000000;
        box-shadow: 0 2px 8px rgba(255, 193, 7, 0.2);
      `;
      break;
    default:
      typeStyles = `
        background: rgba(108, 117, 125, 0.15);
        border-color: #6c757d;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(108, 117, 125, 0.2);
      `;
  }
  
  messageEl.style.cssText = baseStyles + typeStyles;

  container.appendChild(messageEl);

  // Auto remove after duration
  setTimeout(() => {
    if (messageEl.parentNode) {
      messageEl.remove();
    }
  }, actualDuration);

  // Remove on click
  messageEl.addEventListener('click', () => messageEl.remove());
}

function showError(message) {
  showMessage(message, 'error');
}

function showSuccess(message) {
  showMessage(message, 'success');
}

function showWarning(message) {
  showMessage(message, 'warning');
}

// Helper function to get current credentials for breach monitoring
async function getCurrentCredentials() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CREDENTIALS',
      seedPhrase: currentSeedPhrase
    });
    
    if (response.success) {
      return response.credentials || [];
    } else {
      console.error('Failed to get credentials:', response.error);
      return [];
    }
  } catch (error) {
    console.error('Error getting credentials:', error);
    return [];
  }
}

// Main app functionality setup
function setupMainAppEventListeners() {
  // Add password form
  const addPasswordForm = document.getElementById('addPasswordForm');
  if (addPasswordForm) {
    addPasswordForm.addEventListener('submit', handleAddPassword);
  }

  // Credential type toggle
  const credentialType = document.getElementById('credentialType');
  if (credentialType) {
    credentialType.addEventListener('change', toggleCredentialFields);
  }

  // Password generator
  const generatePasswordBtn = document.getElementById('generatePasswordBtn');
  if (generatePasswordBtn) {
    generatePasswordBtn.addEventListener('click', togglePasswordGenerator);
  }

  // Search functionality
  const searchInput = document.getElementById('searchPasswords');
  if (searchInput) {
    searchInput.addEventListener('input', handlePasswordSearch);
  }

  // Breach monitoring functionality - use organized breach UI
  const checkBreachesBtn = document.getElementById('checkBreachesBtn');
  if (checkBreachesBtn) {
    checkBreachesBtn.addEventListener('click', () => {
      breachUI.handleCheckBreaches(getCurrentCredentials, showMessage);
    });
  }
}

// Toggle between login and wallet credential fields
function toggleCredentialFields() {
  const credentialType = document.getElementById('credentialType').value;
  const loginFields = document.getElementById('loginFields');
  const walletFields = document.getElementById('walletFields');

  if (credentialType === 'wallet') {
    loginFields.style.display = 'none';
    walletFields.style.display = 'block';
  } else {
    loginFields.style.display = 'block';
    walletFields.style.display = 'none';
  }
}

// Handle add password form submission
async function handleAddPassword(event) {
  event.preventDefault();
  
  try {
    const credentialType = document.getElementById('credentialType').value;
    let credential;

    if (credentialType === 'wallet') {
      credential = {
        type: 'wallet',
        name: document.getElementById('walletName').value,
        seedPhrase: document.getElementById('walletSeedPhrase').value,
        timestamp: new Date().toISOString()
      };
    } else {
      credential = {
        type: 'login',
        website: document.getElementById('website').value,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        timestamp: new Date().toISOString()
      };
    }

    // Get current credentials and add new one
    const currentData = await chrome.runtime.sendMessage({
      type: 'GET_CREDENTIALS',
      seedPhrase: currentSeedPhrase
    });

    const credentials = Array.isArray(currentData.credentials) ? currentData.credentials : [];
    credentials.push(credential);

    // Store updated credentials
    const storeResponse = await chrome.runtime.sendMessage({
      type: 'STORE_CREDENTIALS',
      credentials: credentials,
      seedPhrase: currentSeedPhrase
    });

    if (!storeResponse.success) {
      throw new Error('Failed to save credential');
    }

    showSuccess('Credential saved successfully!');
    event.target.reset();
    await loadPasswordData();

  } catch (error) {
    console.error('Error saving credential:', error);
    showError('Failed to save credential: ' + error.message);
  }
}

// Load and display passwords
async function loadPasswordData() {
  try {
    if (!currentSeedPhrase) return;

    const response = await chrome.runtime.sendMessage({
      type: 'GET_CREDENTIALS',
      seedPhrase: currentSeedPhrase
    });

    const credentials = Array.isArray(response.credentials) ? response.credentials : [];
    displayCredentials(credentials.filter(c => c.type === 'login' || !c.type));

  } catch (error) {
    console.error('Error loading passwords:', error);
    showError('Failed to load passwords');
  }
}

// Load and display wallet seeds
async function loadWalletSeeds() {
  try {
    if (!currentSeedPhrase) return;

    const response = await chrome.runtime.sendMessage({
      type: 'GET_CREDENTIALS',
      seedPhrase: currentSeedPhrase
    });

    const credentials = Array.isArray(response.credentials) ? response.credentials : [];
    displayWalletSeeds(credentials.filter(c => c.type === 'wallet'));

  } catch (error) {
    console.error('Error loading wallet seeds:', error);
    showError('Failed to load wallet seeds');
  }
}

// Display credentials in the UI
function displayCredentials(credentials) {
  const passwordList = document.getElementById('passwordList');
  if (!passwordList) return;

  if (credentials.length === 0) {
    passwordList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 30px; font-style: italic;">No passwords saved yet. Add your first credential above! 🔒</p>';
    return;
  }

  passwordList.innerHTML = credentials.map((cred, index) => `
    <div class="modern-item">
      <div class="item-header">
        <div class="item-title">🌐 ${cred.website || 'Website Login'}</div>
        <div class="item-actions">
          <button class="btn-sm btn-primary toggle-password-btn" data-index="${index}" data-password="${encodeURIComponent(cred.password || '')}">👁️ Show</button>
          <button class="btn-sm btn-primary copy-btn" data-text="${encodeURIComponent(cred.password || '')}" data-type="Password">📋 Copy</button>
          <button class="btn-sm btn-danger delete-credential-btn" data-index="${index}">🗑️ Delete</button>
        </div>
      </div>
      <div style="margin-top: 12px;">
        <div style="margin-bottom: 8px;">
          <strong style="color: var(--text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Username:</strong>
          <div style="color: var(--text-primary); margin-top: 2px;">${cred.username || 'N/A'}</div>
        </div>
        <div style="margin-bottom: 8px;">
          <strong style="color: var(--text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Password:</strong>
          <div class="password-display" data-index="${index}" style="font-family: monospace; color: var(--primary-green-light); margin-top: 2px; font-weight: 500;">••••••••••••</div>
        </div>
      </div>
    </div>
  `).join('');

  // Add event listeners for this credential list
  addCredentialEventListeners();
}

// Display wallet seeds in the UI
function displayWalletSeeds(walletSeeds) {
  const walletSeedsList = document.getElementById('walletSeedsList');
  if (!walletSeedsList) return;

  if (walletSeeds.length === 0) {
    walletSeedsList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 30px; font-style: italic;">No wallet seeds saved yet. Add wallet credentials using the form above! 💳</p>';
    return;
  }

  walletSeedsList.innerHTML = walletSeeds.map((wallet, index) => `
    <div class="modern-item">
      <div class="item-header">
        <div class="item-title">🔐 ${wallet.name || 'Unnamed Wallet'}</div>
        <div class="item-actions">
          <button class="btn-sm btn-primary toggle-seed-btn" data-index="${index}" data-seed="${encodeURIComponent(wallet.seedPhrase || '')}">👁️ Show</button>
          <button class="btn-sm btn-primary copy-btn" data-text="${encodeURIComponent(wallet.seedPhrase || '')}" data-type="Seed phrase">📋 Copy</button>
          <button class="btn-sm btn-danger delete-wallet-btn" data-index="${index}">🗑️ Delete</button>
        </div>
      </div>
      <div style="margin-top: 12px;">
        <div style="margin-bottom: 8px;">
          <strong style="color: var(--text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Seed Phrase:</strong>
          <div class="seed-display" data-index="${index}" style="font-family: monospace; color: var(--primary-green-light); margin-top: 2px; font-weight: 500; word-break: break-all; line-height: 1.4;">••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••</div>
        </div>
      </div>
    </div>
  `).join('');

  // Add event listeners for this wallet list
  addWalletEventListeners();
}

// Global functions for UI interactions
window.togglePasswordVisibility = function(index, password, buttonIndex) {
  const element = document.getElementById(`password-${index}`);
  const button = document.getElementById(`toggleBtn-${buttonIndex}`);
  
  if (element.textContent.includes('••••')) {
    element.textContent = password;
    button.innerHTML = '🙈 Hide';
  } else {
    element.textContent = '••••••••••••';
    button.innerHTML = '👁️ Show';
  }
};

window.toggleSeedVisibility = function(index, seedPhrase, buttonIndex) {
  const element = document.getElementById(`seed-${index}`);
  const button = document.getElementById(`seedToggleBtn-${buttonIndex}`);
  
  if (element.textContent.includes('••••')) {
    element.textContent = seedPhrase;
    button.innerHTML = '🙈 Hide';
  } else {
    element.textContent = '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••';
    button.innerHTML = '👁️ Show';
  }
};

window.copyToClipboard = async function(text, type = 'Text') {
  try {
    await navigator.clipboard.writeText(text);
    showSuccess(`${type} copied to clipboard! 📋`);
  } catch (error) {
    showError('Failed to copy to clipboard');
  }
};

// Event delegation functions for credentials
function addCredentialEventListeners() {
  const passwordList = document.getElementById('passwordList');
  if (!passwordList) return;

  // Remove previous listeners
  passwordList.removeEventListener('click', handleCredentialClick);
  // Add new listener
  passwordList.addEventListener('click', handleCredentialClick);
}

function handleCredentialClick(event) {
  const target = event.target;
  
  if (target.classList.contains('toggle-password-btn')) {
    const index = target.dataset.index;
    const password = decodeURIComponent(target.dataset.password);
    const element = document.querySelector(`.password-display[data-index="${index}"]`);
    
    if (element.textContent.includes('••••')) {
      element.textContent = password;
      target.innerHTML = '🙈 Hide';
    } else {
      element.textContent = '••••••••••••';
      target.innerHTML = '👁️ Show';
    }
  }
  
  else if (target.classList.contains('copy-btn')) {
    const text = decodeURIComponent(target.dataset.text);
    const type = target.dataset.type;
    copyToClipboard(text, type);
  }
  
  else if (target.classList.contains('delete-credential-btn')) {
    const index = parseInt(target.dataset.index);
    deleteCredential(index);
  }
}

// Event delegation functions for wallets
function addWalletEventListeners() {
  const walletSeedsList = document.getElementById('walletSeedsList');
  if (!walletSeedsList) return;

  // Remove previous listeners
  walletSeedsList.removeEventListener('click', handleWalletClick);
  // Add new listener
  walletSeedsList.addEventListener('click', handleWalletClick);
}

function handleWalletClick(event) {
  const target = event.target;
  
  if (target.classList.contains('toggle-seed-btn')) {
    const index = target.dataset.index;
    const seedPhrase = decodeURIComponent(target.dataset.seed);
    const element = document.querySelector(`.seed-display[data-index="${index}"]`);
    
    if (element.textContent.includes('••••')) {
      element.textContent = seedPhrase;
      target.innerHTML = '🙈 Hide';
    } else {
      element.textContent = '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••';
      target.innerHTML = '👁️ Show';
    }
  }
  
  else if (target.classList.contains('copy-btn')) {
    const text = decodeURIComponent(target.dataset.text);
    const type = target.dataset.type;
    copyToClipboard(text, type);
  }
  
  else if (target.classList.contains('delete-wallet-btn')) {
    const index = parseInt(target.dataset.index);
    deleteWalletSeed(index);
  }
}

// Updated copy function
async function copyToClipboard(text, type = 'Text') {
  try {
    await navigator.clipboard.writeText(text);
    showSuccess(`${type} copied to clipboard! 📋`);
  } catch (error) {
    showError('Failed to copy to clipboard');
  }
}

async function deleteCredential(index) {
  if (!confirm('Are you sure you want to delete this credential?')) return;
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CREDENTIALS',
      seedPhrase: currentSeedPhrase
    });

    const credentials = Array.isArray(response.credentials) ? response.credentials : [];
    const loginCredentials = credentials.filter(c => c.type === 'login' || !c.type);
    const otherCredentials = credentials.filter(c => c.type !== 'login' && c.type);
    
    loginCredentials.splice(index, 1);
    const updatedCredentials = [...loginCredentials, ...otherCredentials];

    const storeResponse = await chrome.runtime.sendMessage({
      type: 'STORE_CREDENTIALS',
      credentials: updatedCredentials,
      seedPhrase: currentSeedPhrase
    });

    if (!storeResponse.success) {
      throw new Error('Failed to delete credential');
    }

    showSuccess('Credential deleted successfully');
    await loadPasswordData();

  } catch (error) {
    console.error('Error deleting credential:', error);
    showError('Failed to delete credential');
  }
}

async function deleteWalletSeed(index) {
  if (!confirm('Are you sure you want to delete this wallet seed?')) return;
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CREDENTIALS',
      seedPhrase: currentSeedPhrase
    });

    const credentials = Array.isArray(response.credentials) ? response.credentials : [];
    const walletCredentials = credentials.filter(c => c.type === 'wallet');
    const otherCredentials = credentials.filter(c => c.type !== 'wallet');
    
    walletCredentials.splice(index, 1);
    const updatedCredentials = [...otherCredentials, ...walletCredentials];

    const storeResponse = await chrome.runtime.sendMessage({
      type: 'STORE_CREDENTIALS',
      credentials: updatedCredentials,
      seedPhrase: currentSeedPhrase
    });

    if (!storeResponse.success) {
      throw new Error('Failed to delete wallet seed');
    }

    showSuccess('Wallet seed deleted successfully');
    await loadWalletSeeds();

  } catch (error) {
    console.error('Error deleting wallet seed:', error);
    showError('Failed to delete wallet seed');
  }
}

// Password search functionality
function handlePasswordSearch() {
  const searchTerm = document.getElementById('searchPasswords').value.toLowerCase();
  const passwordItems = document.querySelectorAll('.modern-item');
  
  passwordItems.forEach(item => {
    const text = item.textContent.toLowerCase();
    if (text.includes(searchTerm)) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}

// Password generator toggle
function togglePasswordGenerator() {
  const options = document.getElementById('passwordGeneratorOptions');
  if (options.style.display === 'none' || !options.style.display) {
    options.style.display = 'block';
    setupPasswordGenerator();
  } else {
    options.style.display = 'none';
  }
}

// Setup password generator functionality
function setupPasswordGenerator() {
  const lengthSlider = document.getElementById('passwordLength');
  const lengthValue = document.getElementById('passwordLengthValue');
  
  if (lengthSlider && lengthValue) {
    lengthSlider.addEventListener('input', (e) => {
      lengthValue.textContent = e.target.value;
      generatePasswordPreview();
    });
  }

  // Setup checkboxes
  ['includeUppercase', 'includeLowercase', 'includeNumbers', 'includeSymbols'].forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener('change', generatePasswordPreview);
    }
  });

  // Generate initial preview
  generatePasswordPreview();
}

// Generate password preview
function generatePasswordPreview() {
  const length = document.getElementById('passwordLength')?.value || 12;
  const includeUppercase = document.getElementById('includeUppercase')?.checked || true;
  const includeLowercase = document.getElementById('includeLowercase')?.checked || true;
  const includeNumbers = document.getElementById('includeNumbers')?.checked || true;
  const includeSymbols = document.getElementById('includeSymbols')?.checked || true;

  const password = generatePassword(length, {
    uppercase: includeUppercase,
    lowercase: includeLowercase,
    numbers: includeNumbers,
    symbols: includeSymbols
  });

  const generatedList = document.getElementById('generatedPasswordsList');
  if (generatedList) {
    generatedList.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
        <input type="text" value="${password}" readonly style="flex: 1; font-family: monospace;">
        <button class="use-generated-password-btn" data-password="${password}" style="white-space: nowrap;">Use This</button>
      </div>
    `;
    
    // Add event listener for the use password button
    const useBtn = generatedList.querySelector('.use-generated-password-btn');
    useBtn?.addEventListener('click', (e) => {
      const password = e.target.dataset.password;
      useGeneratedPassword(password);
    });
  }
}

// Generate password with options
function generatePassword(length, options) {
  let chars = '';
  if (options.uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (options.lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (options.numbers) chars += '0123456789';
  if (options.symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';

  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Use generated password
function useGeneratedPassword(password) {
  const passwordInput = document.getElementById('password');
  if (passwordInput) {
    passwordInput.value = password;
    document.getElementById('passwordGeneratorOptions').style.display = 'none';
    showSuccess('Password applied!');
  }
}

// Quick test function for debugging
window.quickTest = async function() {
  
  try {
    const pingResponse = await chrome.runtime.sendMessage({ type: 'PING' });
    

    const loginStatus = await checkLoginStatus();
    

    
    return true;
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return false;
  }
};

// Handle skip setup - immediate login with seed phrase
async function handleSkipToLogin() {
  try {
    if (!currentSeedPhrase) {
      throw new Error('No seed phrase generated');
    }

    showSuccess('Logging in with your new seed phrase...');
    
    // Immediately login to main app without PIN setup
    setTimeout(async () => {
      await showMainApp();
    }, 1500);

  } catch (error) {
    console.error('Skip to login error:', error);
    showError(error.message);
  }
}

// Handle continue setup - show PIN configuration
function handleContinueSetup() {
  document.getElementById('quickAccessOption').style.display = 'none';
  document.getElementById('seedConfirmationStep').style.display = 'block';
  
  // Pre-fill the confirmation if user wants to continue with full setup
  const confirmInput = document.getElementById('confirmSeedInput');
  if (confirmInput && currentSeedPhrase) {
    confirmInput.value = currentSeedPhrase;
  }
  
  showSuccess('Complete the setup to add PIN protection to your wallet.');
}

// Settings Modal Functions
function showSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'block';
  }
}

function hideSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Setup settings event listeners
function setupSettingsEventListeners() {
  // Backup storage type change
  const backupStorageType = document.getElementById('backupStorageType');
  if (backupStorageType) {
    backupStorageType.addEventListener('change', handleBackupStorageChange);
  }

  // Connection test buttons
  const testSiaBtn = document.getElementById('testSiaConnection');
  if (testSiaBtn) {
    testSiaBtn.addEventListener('click', testSiaConnection);
  }

  // Save backup settings
  const saveBackupBtn = document.getElementById('saveBackupSettings');
  if (saveBackupBtn) {
    saveBackupBtn.addEventListener('click', saveBackupSettings);
  }

  // PIN change functionality
  const changePinBtn = document.getElementById('changePinBtn');
  if (changePinBtn) {
    changePinBtn.addEventListener('click', handlePinChange);
  }

  // PIN input validation (numbers only)
  ['currentPin', 'newPin', 'confirmNewPin'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', validatePinInput);
    }
  });

  // Session timeout change
  const sessionTimeout = document.getElementById('sessionTimeout');
  if (sessionTimeout) {
    sessionTimeout.addEventListener('change', handleSessionTimeoutChange);
  }

  // Auto-lock settings
  const lockOnClose = document.getElementById('lockOnClose');
  if (lockOnClose) {
    lockOnClose.addEventListener('change', handleAutoLockChange);
  }

  const lockOnSleep = document.getElementById('lockOnSleep');
  if (lockOnSleep) {
    lockOnSleep.addEventListener('change', handleAutoLockChange);
  }

  // Data management buttons
  const syncDataBtn = document.getElementById('syncDataBtn');
  if (syncDataBtn) {
    syncDataBtn.addEventListener('click', handleDataSync);
  }

  // SIA backup management buttons
  const listSiaBackupsBtn = document.getElementById('listSiaBackupsBtn');
  if (listSiaBackupsBtn) {
    listSiaBackupsBtn.addEventListener('click', handleListSiaBackups);
  }

  const restoreSiaBackupBtn = document.getElementById('restoreSiaBackupBtn');
  if (restoreSiaBackupBtn) {
    restoreSiaBackupBtn.addEventListener('click', handleRestoreSiaBackup);
  }

  const siaBackupSelect = document.getElementById('siaBackupSelect');
  if (siaBackupSelect) {
    siaBackupSelect.addEventListener('change', handleSiaBackupSelection);
  }

  // Danger zone buttons
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', handleClearCache);
  }

  const resetDataBtn = document.getElementById('resetDataBtn');
  if (resetDataBtn) {
    resetDataBtn.addEventListener('click', handleResetData);
  }

  // Load current settings
  loadCurrentSettings();
}

// Handle backup storage type change
function handleBackupStorageChange() {
  const selectedType = document.getElementById('backupStorageType').value;
  
  // Hide all config sections
  document.getElementById('securesphereConfig').style.display = 'none';
  document.getElementById('siaConfig').style.display = 'none';
  document.getElementById('localConfig').style.display = 'none';
  
  // Show selected config section
  document.getElementById(selectedType + 'Config').style.display = 'block';

  // Show/hide SIA backup management section
  const siaBackupManagement = document.getElementById('siaBackupManagement');
  if (siaBackupManagement) {
    siaBackupManagement.style.display = selectedType === 'sia' ? 'block' : 'none';
  }
}

// Test SIA connection
async function testSiaConnection() {
  const btn = document.getElementById('testSiaConnection');
  const statusDiv = document.getElementById('siaStatus');
  const putCommandDiv = document.getElementById('siaPutCommand');
  
  const ip = document.getElementById('siaIpAddress').value.trim();
  const port = document.getElementById('siaPort').value.trim();
  const password = document.getElementById('siaPassword').value;

  // Input validation
  const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  if (!ipRegex.test(ip)) {
    showSettingsStatus('siaStatus', 'Invalid IP address format', 'error');
    return;
  }

  if (!port || isNaN(parseInt(port))) {
    showSettingsStatus('siaStatus', 'Invalid port number', 'error');
    return;
  }

  if (!password) {
    showSettingsStatus('siaStatus', 'Password is required', 'error');
    return;
  }

  // Show loading state
  btn.classList.add('loading');
  btn.disabled = true;
  statusDiv.style.display = 'none';
  putCommandDiv.style.display = 'none';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TEST_SIA_CONNECTION',
      config: { ip, port, password }
    });

    if (response.success) {
      showSettingsStatus('siaStatus', '✅ Connected to Self-Hosted SIA successfully!', 'success');
      
      // Show PUT command
      const putCommand = `curl -X PUT "http://${ip}:${port}/api/worker/objects/backup/test.txt" \\
  -H "Authorization: Basic ${btoa(':' + password)}" \\
  -d "test data"`;
      
      document.getElementById('siaPutCommandText').textContent = putCommand;
      putCommandDiv.style.display = 'block';
    } else {
      showSettingsStatus('siaStatus', '❌ Connection failed: ' + (response.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('SIA connection test error:', error);
    showSettingsStatus('siaStatus', '❌ Connection error: ' + error.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// Save backup settings
async function saveBackupSettings() {
  const btn = document.getElementById('saveBackupSettings');
  const backupType = document.getElementById('backupStorageType').value;

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    let config = { type: backupType };

    // Collect configuration based on type
    if (backupType === 'sia') {
      config = {
        ...config,
        ip: document.getElementById('siaIpAddress').value.trim(),
        port: document.getElementById('siaPort').value.trim(),
        password: document.getElementById('siaPassword').value
      };
    }

    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_BACKUP_SETTINGS',
      config
    });

    if (response.success) {
      showSuccess('Backup settings saved successfully! 💾');
    } else {
      showError('Failed to save backup settings: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Save backup settings error:', error);
    showError('Failed to save backup settings: ' + error.message);
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// Handle PIN change
async function handlePinChange() {
  const btn = document.getElementById('changePinBtn');
  const statusDiv = document.getElementById('pinChangeStatus');
  
  const currentPin = document.getElementById('currentPin').value;
  const newPin = document.getElementById('newPin').value;
  const confirmNewPin = document.getElementById('confirmNewPin').value;

  // Validation
  if (!currentPin) {
    showSettingsStatus('pinChangeStatus', 'Current PIN is required', 'error');
    return;
  }

  if (!newPin || newPin.length < 4) {
    showSettingsStatus('pinChangeStatus', 'New PIN must be at least 4 digits', 'error');
    return;
  }

  if (newPin !== confirmNewPin) {
    showSettingsStatus('pinChangeStatus', 'New PIN codes do not match', 'error');
    return;
  }

  if (!/^\d+$/.test(newPin)) {
    showSettingsStatus('pinChangeStatus', 'PIN must contain only numbers', 'error');
    return;
  }

  // Show loading state
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CHANGE_PIN',
      currentPin,
      newPin
    });

    if (response.success) {
      showSettingsStatus('pinChangeStatus', '✅ PIN changed successfully!', 'success');
      
      // Clear form
      document.getElementById('currentPin').value = '';
      document.getElementById('newPin').value = '';
      document.getElementById('confirmNewPin').value = '';
    } else {
      showSettingsStatus('pinChangeStatus', '❌ ' + (response.error || 'Failed to change PIN'), 'error');
    }
  } catch (error) {
    console.error('PIN change error:', error);
    showSettingsStatus('pinChangeStatus', '❌ Error changing PIN: ' + error.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// Handle session timeout change
async function handleSessionTimeoutChange() {
  const timeout = document.getElementById('sessionTimeout').value;
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'UPDATE_SESSION_TIMEOUT',
      timeout: parseInt(timeout)
    });

    if (response.success) {
      showSuccess(`Session timeout updated to ${timeout} minutes ⏰`);
    }
  } catch (error) {
    console.error('Session timeout update error:', error);
    showError('Failed to update session timeout');
  }
}

// Handle auto-lock changes
async function handleAutoLockChange() {
  const lockOnClose = document.getElementById('lockOnClose').checked;
  const lockOnSleep = document.getElementById('lockOnSleep').checked;
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'UPDATE_AUTO_LOCK_SETTINGS',
      lockOnClose,
      lockOnSleep
    });

    if (response.success) {
      showSuccess('Auto-lock settings updated 🔒');
    }
  } catch (error) {
    console.error('Auto-lock settings error:', error);
    showError('Failed to update auto-lock settings');
  }
}

// Handle data sync
async function handleDataSync() {
  const btn = document.getElementById('syncDataBtn');
  
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SYNC_DATA'
    });

    if (response.success) {
      showSuccess('Data synchronized successfully! 🔄');
      // Reload password data
      await loadPasswordData();
      await loadWalletSeeds();
    } else {
      showError('Sync failed: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Data sync error:', error);
    showError('Sync failed: ' + error.message);
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// Handle clear cache
async function handleClearCache() {
  if (!confirm('Are you sure you want to clear the cache? This will remove temporary data but keep your passwords safe.')) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_CACHE'
    });

    if (response.success) {
      showSuccess('Cache cleared successfully! 🗑️');
    } else {
      showError('Failed to clear cache: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Clear cache error:', error);
    showError('Failed to clear cache: ' + error.message);
  }
}

// Handle reset data
async function handleResetData() {
  if (!confirm('⚠️ DANGER: This will permanently delete ALL your data including passwords, wallet seeds, and settings. This action cannot be undone!\n\nType "DELETE EVERYTHING" to confirm:')) {
    return;
  }

  const confirmation = prompt('Type "DELETE EVERYTHING" to confirm (case sensitive):');
  if (confirmation !== 'DELETE EVERYTHING') {
    showError('Reset cancelled - confirmation text did not match');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'RESET_ALL_DATA'
    });

    if (response.success) {
      showSuccess('All data has been reset. You will be redirected to setup...');
      
      // Clear local state
      currentSeedPhrase = '';
      currentUserSession = null;
      isLoggedIn = false;
      
      // Redirect to welcome screen after delay
      setTimeout(() => {
        showWelcomeScreen();
        hideSettingsModal();
      }, 2000);
    } else {
      showError('Failed to reset data: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Reset data error:', error);
    showError('Failed to reset data: ' + error.message);
  }
}

// Load current settings
async function loadCurrentSettings() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SETTINGS'
    });

    if (response.success) {
      const settings = response.settings;
      
      // Load backup settings
      if (settings.backup) {
        document.getElementById('backupStorageType').value = settings.backup.type || 'securesphere';
        handleBackupStorageChange();
        
        if (settings.backup.type === 'sia') {
          document.getElementById('siaIpAddress').value = settings.backup.ip || '';
          document.getElementById('siaPort').value = settings.backup.port || '';
          document.getElementById('siaPassword').value = settings.backup.password || '';
        }
      }
      
      // Load session settings
      if (settings.session) {
        document.getElementById('sessionTimeout').value = settings.session.timeout || 30;
      }
      
      // Load auto-lock settings
      if (settings.autoLock) {
        document.getElementById('lockOnClose').checked = settings.autoLock.onClose !== false;
        document.getElementById('lockOnSleep').checked = settings.autoLock.onSleep || false;
      }
      
      // Load build number
      document.getElementById('buildNumber').textContent = settings.buildNumber || 'Unknown';
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Show settings status message
function showSettingsStatus(elementId, message, type) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.textContent = message;
  element.className = `status-message ${type}`;
  element.style.display = 'block';
  
  // Auto-hide after 5 seconds for success messages
  if (type === 'success') {
    setTimeout(() => {
      element.style.display = 'none';
    }, 5000);
  }
}

// Handle list SIA backups
async function handleListSiaBackups() {
  const btn = document.getElementById('listSiaBackupsBtn');
  const backupList = document.getElementById('siaBackupList');
  const backupSelect = document.getElementById('siaBackupSelect');
  const statusDiv = document.getElementById('siaBackupStatus');
  
  btn.classList.add('loading');
  btn.disabled = true;
  statusDiv.style.display = 'none';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'LIST_SIA_BACKUPS'
    });

    if (response.success) {
      // Clear previous options
      backupSelect.innerHTML = '<option value="">Select a backup to restore...</option>';
      
      if (response.backups && response.backups.length > 0) {
        // Add backup options
        response.backups.forEach((backup, index) => {
          const option = document.createElement('option');
          option.value = backup.path;
          option.textContent = `${backup.name} (${backup.date}) - ${(backup.size / 1024).toFixed(1)}KB`;
          backupSelect.appendChild(option);
        });
        
        backupList.style.display = 'block';
        showSettingsStatus('siaBackupStatus', `✅ Found ${response.backups.length} backups`, 'success');
      } else {
        backupList.style.display = 'none';
        showSettingsStatus('siaBackupStatus', 'ℹ️ No backups found on SIA node', 'success');
      }
    } else {
      showSettingsStatus('siaBackupStatus', '❌ Failed to list backups: ' + (response.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('List SIA backups error:', error);
    showSettingsStatus('siaBackupStatus', '❌ Error listing backups: ' + error.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// Handle SIA backup selection
function handleSiaBackupSelection() {
  const backupSelect = document.getElementById('siaBackupSelect');
  const restoreBtn = document.getElementById('restoreSiaBackupBtn');
  
  if (restoreBtn) {
    restoreBtn.disabled = !backupSelect.value;
  }
}

// Handle restore SIA backup
async function handleRestoreSiaBackup() {
  const backupSelect = document.getElementById('siaBackupSelect');
  const selectedBackup = backupSelect.value;
  
  if (!selectedBackup) {
    showSettingsStatus('siaBackupStatus', '⚠️ Please select a backup to restore', 'error');
    return;
  }

  if (!confirm(`Are you sure you want to restore the selected backup?\n\nThis will merge the backup data with your current credentials.`)) {
    return;
  }

  const btn = document.getElementById('restoreSiaBackupBtn');
  const statusDiv = document.getElementById('siaBackupStatus');
  
  btn.classList.add('loading');
  btn.disabled = true;
  statusDiv.style.display = 'none';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'RESTORE_SIA_BACKUP',
      backupPath: selectedBackup
    });

    if (response.success) {
      showSettingsStatus('siaBackupStatus', 
        `✅ ${response.message || 'Backup restored successfully'}`, 'success');
      
      // Reload password data in main app
      if (typeof loadPasswordData === 'function') {
        await loadPasswordData();
      }
      if (typeof loadWalletSeeds === 'function') {
        await loadWalletSeeds();
      }
      
      showSuccess(`Backup restored successfully! ${response.credentialCount || 0} items restored.`);
    } else {
      showSettingsStatus('siaBackupStatus', '❌ Restore failed: ' + (response.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Restore SIA backup error:', error);
    showSettingsStatus('siaBackupStatus', '❌ Restore error: ' + error.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// Global function for toggling breach details (needed by the breach UI)
window.toggleBreachDetails = function(detailsId) {
  const detailsElement = document.getElementById(detailsId);
  if (detailsElement) {
    if (detailsElement.style.display === 'none' || !detailsElement.style.display) {
      detailsElement.style.display = 'block';
    } else {
      detailsElement.style.display = 'none';
    }
  }
};
