// Background script for SecureSphere Password Manager

import CryptoJS from 'crypto-js';
import * as bip39 from 'bip39';
import { encryptData, decryptData } from './lib/password/index.js';
import { 
  generateKeyFromSeedBytes,
  generateStorageEncryptionKey,
  secureStorageSet,
  secureStorageGet,
  migrateToEncryptedStorage,
  verifyStorageEncryption
} from './lib/key/index.js';
import { secureAuth } from './lib/auth/secure-auth.js';
import { API_CONFIG } from './lib/config/api-config.js';
import { breachController } from './lib/breach/breach-controller.js';
import { ENV } from './lib/config/environment.js';

// ============================================================================
// NEW MODULAR CONTROLLERS - REPLACING LEGACY FUNCTIONS
// ============================================================================
import { authController } from './lib/auth/auth-controller.js';
import { passwordController } from './lib/password/password-controller.js';

// Extension initialization state
let isInitialized = false;

// Initialize the modular controllers


// Legacy compatibility variables (will be phased out)
let currentStorageKey = null; 
let currentUserSession = null;
let sessionTimeout = 30 * 60 * 1000; // 30 minutes in milliseconds

// ============================================================================
// ANTI-STEALER PROTECTION: Secure Storage Manager
// ============================================================================

/**
 * Initialize storage encryption system
 * This protects against stealer malware attacks
 */
const initializeStorageEncryption = async (seedPhrase) => {
  try {
    
    
    // Generate storage encryption key from seed phrase
    currentStorageKey = await generateStorageEncryptionKey(seedPhrase);
    
    
    // Verify encryption system is working
    const verificationResult = await verifyStorageEncryption(currentStorageKey);
    if (!verificationResult) {
      throw new Error('Storage encryption verification failed');
    }
    
    // Migrate existing data to encrypted format
    await migrateToEncryptedStorage(currentStorageKey);
    
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize storage encryption:', error);
    currentStorageKey = null;
    throw error;
  }
};

/**
 * Secure wrapper for storage operations
 * Automatically handles encryption/decryption
 */
const secureStorage = {
  set: async (items) => {
    if (!currentStorageKey) {
      
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
    return secureStorageSet(items, currentStorageKey);
  },
  
  get: async (keys) => {
    if (!currentStorageKey) {
      
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
    return secureStorageGet(keys, currentStorageKey);
  }
};

// Initialize BIP39 module
const initBip39 = async () => {
  try {
    
    if (!bip39) {
      console.error('BIP39 module is undefined');
      throw new Error('BIP39 module not loaded');
    }
    if (!bip39.generateMnemonic) {
      console.error('BIP39 generateMnemonic function is missing');
      throw new Error('BIP39 module missing required functions');
    }
    
    return bip39;
  } catch (error) {
    console.error('Error initializing BIP39:', error);
    throw new Error('Failed to initialize BIP39 module');
  }
};

// Check if extension is being installed for the first time
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ firstTimeSetup: true });
  }
});

// Set a flag when initialization is complete
const markInitialized = () => {
  isInitialized = true;
  
};

// Initialize the background service
const initBackgroundService = async () => {
  try {
    await initBip39();
    markInitialized();
    return true;
  } catch (error) {
    console.error('Failed to initialize background service:', error);
    return false;
  }
};

// Call initialization when the background script loads
initBackgroundService();

// Generate a new seed phrase
const generateSeedPhrase = async () => {
  try {
    
    const bip39Module = await initBip39();
    
    
    const seedPhrase = bip39Module.generateMnemonic(256); // Use 256 bits of entropy for extra security
    
    
    if (!seedPhrase) {
      console.error('Generated seed phrase is null or undefined');
      throw new Error('Failed to generate seed phrase - null result');
    }
    
    if (!validateSeedPhrase(seedPhrase)) {
      console.error('Seed phrase validation failed:', seedPhrase);
      throw new Error('Generated seed phrase validation failed');
    }
    
    
    return seedPhrase;
  } catch (error) {
    console.error('Error in generateSeedPhrase:', error);
    throw new Error('Failed to generate seed phrase: ' + error.message);
  }
};

// Validate seed phrase
const validateSeedPhrase = (seedPhrase) => {
  // Validate using BIP39 standard
  return bip39.validateMnemonic(seedPhrase);
};

// Store credentials securely in local storage
const storeCredentials = async (credentials, seedPhrase, timestamp = null, retryCount = 0) => {
  try {
    console.log('storeCredentials called with:', {
      credentialCount: credentials?.length,
      hasSeedPhrase: !!seedPhrase,
      hasTimestamp: !!timestamp,
      retryCount
    });

    if (!chrome.storage || !chrome.storage.local) {
      throw new Error('Chrome storage API not available');
    }

    // Initialize anti-stealer protection if not already done
    if (!currentStorageKey) {
      
      await initializeStorageEncryption(seedPhrase);
    }

    
    const bip39Module = await initBip39();
    const seed = await bip39Module.mnemonicToSeed(seedPhrase);
    
    :', Array.from(seed.slice(0, 8)));
    
    const { encryptionKey: key } = await generateKeyFromSeedBytes(seed);
    
    
    // Export the key to check its properties during storage
    try {
      const exportedKey = await crypto.subtle.exportKey('raw', key);
      
      :', Array.from(new Uint8Array(exportedKey.slice(0, 8))));
    } catch (exportError) {
      
    }
    
    const dataToStore = {
      credentials,
      timestamp: timestamp || new Date().toISOString()
    };
    console.log('Data to store structure:', {
      credentialCount: dataToStore.credentials.length,
      timestamp: dataToStore.timestamp
    });

    
    const encrypted = await encryptData(JSON.stringify(dataToStore), key);
    console.log('Data encrypted successfully, structure:', {
      hasIv: !!encrypted.iv,
      hasData: !!encrypted.data,
      ivLength: encrypted.iv?.length,
      dataLength: encrypted.data?.length
    });
    
    try {
      
      await secureStorage.set({
        credentials: encrypted,
        hasSeedPhrase: true
      });
      
    } catch (storageError) {
      console.error('Storage error occurred:', storageError);
      if (retryCount < 3) {
        ...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return storeCredentials(credentials, seedPhrase, timestamp, retryCount + 1);
      }
      throw storageError;
    }
    
    // Create a backup record with secure storage
    try {
      
      const backupResult = await secureStorage.get(['backups']);
      const backups = backupResult.backups || [];
      const newBackup = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        credentialCount: credentials.length
      };
      const updatedBackups = [newBackup, ...backups].slice(0, 10);
      await secureStorage.set({ 
        backups: updatedBackups,
        currentBackupId: newBackup.id
      });
      
    } catch (backupError) {
      console.error('Local backup tracking failed:', backupError);
    }
    
    return true;
  } catch (error) {
    console.error('Error storing credentials:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    return false;
  }
};

// Get list of available backups
const getBackups = async () => {
  try {
    const { backups = [] } = await chrome.storage.local.get(['backups']);
    return backups;
  } catch (error) {
    console.error('Error getting backups:', error);
    return [];
  }
};

// Restore from a specific backup
const restoreFromBackup = async (backupId, seedPhrase) => {
  try {
    const bip39Module = await initBip39();
    const seed = await bip39Module.mnemonicToSeed(seedPhrase);
    const { encryptionKey: key } = await generateKeyFromSeedBytes(seed);
    const { credentials } = await chrome.storage.local.get(['credentials']);
    
    if (!credentials) {
      throw new Error('No credentials found to restore');
    }
    
    const decrypted = await decryptData(credentials, key);
    const data = JSON.parse(decrypted);
    
    await chrome.storage.local.set({
      currentBackupId: backupId
    });
    
    return data.credentials;
  } catch (error) {
    console.error('Error restoring from backup:', error);
    throw new Error('Failed to restore from backup');
  }
};

// Store PIN code securely
const storePinCode = async (pin, seedPhrase) => {
  try {
    // Initialize anti-stealer protection if not already done
    if (!currentStorageKey) {
      
      await initializeStorageEncryption(seedPhrase);
    }

    const bip39Module = await initBip39();
    const seed = await bip39Module.mnemonicToSeed(seedPhrase);
    const { encryptionKey: key } = await generateKeyFromSeedBytes(seed);
    
    // Encrypt PIN with seed-derived key
    const encryptedPin = await encryptData(pin, key);
    await secureStorage.set({ pinCode: encryptedPin });
    
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
        iterations: 100000,
        hash: 'SHA-256'
      },
      pinKeyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Encrypt seed phrase with PIN-derived key
    const encryptedSeed = await encryptData(seedPhrase, pinDerivedKey);
    await secureStorage.set({ encryptedSeedPhrase: encryptedSeed });
    
    
    return true;
  } catch (error) {
    console.error('Error storing PIN code:', error);
    return false;
  }
};

// Verify PIN code
const verifyPinCode = async (pin) => {
  try {
    const result = await secureStorage.get(['pinCode', 'encryptedSeedPhrase']);
    const { pinCode, encryptedSeedPhrase } = result;
    
    if (!pinCode || !encryptedSeedPhrase) {
      return { verified: false, error: 'PIN not set or seed phrase not found' };
    }

    // First decrypt the seed phrase using a temporary key derived from PIN
    // This is a simplified approach - in production you'd want a more secure key derivation
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
        iterations: 100000,
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
    if (!currentStorageKey) {
      await initializeStorageEncryption(seedPhrase);
    }

    // Now verify the PIN by encrypting it with the seed-derived key
    const bip39Module = await initBip39();
    const seed = await bip39Module.mnemonicToSeed(seedPhrase);
    const { encryptionKey: key } = await generateKeyFromSeedBytes(seed);
    
    const decryptedPin = await decryptData(pinCode, key);
    
    if (decryptedPin === pin) {
      
      
      // Create user session for successful PIN verification
      createUserSession(seedPhrase);
      
      return { verified: true, seedPhrase };
    } else {
      return { verified: false, error: 'Invalid PIN' };
    }
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return { verified: false, error: error.message };
  }
};

// Check if user is logged in
const checkLoginStatus = async () => {
  try {
    // Check if user has a valid active session
    const hasValidSession = isSessionValid();
    
    // Use secure storage if available, otherwise fallback to regular storage
    let result;
    if (currentStorageKey) {
      result = await secureStorage.get([
        'hasSeedPhrase', 
        'encryptedSeedPhrase', 
        'storedSeedPhrase', 
        'firstTimeSetup',
        'pinCode',
        'credentials'
      ]);
    } else {
      result = await new Promise((resolve, reject) => {
        chrome.storage.local.get([
          'hasSeedPhrase', 
          'encryptedSeedPhrase', 
          'storedSeedPhrase', 
          'firstTimeSetup',
          'pinCode',
          'credentials'
        ], (res) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(res);
          }
        });
      });
    }
    
    const { 
      hasSeedPhrase, 
      encryptedSeedPhrase, 
      storedSeedPhrase, 
      firstTimeSetup,
      pinCode,
      credentials
    } = result;

    console.log('Login status check:', {
      firstTimeSetup,
      hasSeedPhrase: !!hasSeedPhrase,
      hasEncryptedSeedPhrase: !!encryptedSeedPhrase,
      hasStoredSeedPhrase: !!storedSeedPhrase,
      hasPinCode: !!pinCode,
      hasCredentials: !!credentials,
      hasValidSession
    });

    // Brand new user
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
    console.error('Error checking login status:', error);
    return { 
      isLoggedIn: false, 
      requiresPin: false, 
      firstTimeSetup: false,
      hasStoredCredentials: false,
      hasPinSetup: false
    };
  }
};

// Retrieve credentials using seed phrase
const getCredentials = async (seedPhrase, retryCount = 0) => {
  try {
    
    
    if (!chrome.storage || !chrome.storage.local) {
      throw new Error('Chrome storage API not available');
    }

    if (!seedPhrase) {
      
      try {
        // Try secure storage first, then fallback to regular storage
        let result;
        if (currentStorageKey) {
          result = await secureStorage.get(['credentials']);
        } else {
          result = await new Promise((resolve, reject) => {
            chrome.storage.local.get('credentials', (res) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(res);
              }
            });
          });
        }
        
        if (!result || !result.credentials) {
          
          return { credentials: [], walletSeeds: [], error: 'No credentials found' };
        }
        
        return { credentials: result.credentials, walletSeeds: result.walletSeeds || [] };
      } catch (storageError) {
        console.error('Error accessing storage:', storageError);
        return { credentials: [], walletSeeds: [], error: storageError.message || 'Failed to access storage' };
      }
    }

    try {
      
      if (!validateSeedPhrase(seedPhrase)) {
        console.error('Invalid seed phrase format');
        return { credentials: [], walletSeeds: [], error: 'Invalid seed phrase' };
      }

      // Initialize anti-stealer protection if not already done
      if (!currentStorageKey) {
        
        await initializeStorageEncryption(seedPhrase);
      }
      
      
      const bip39Module = await initBip39();
      const seed = await bip39Module.mnemonicToSeed(seedPhrase);
      
      :', Array.from(seed.slice(0, 8)));
      
      const { encryptionKey: key } = await generateKeyFromSeedBytes(seed);
      
      
      // Export the key to check its properties
      try {
        const exportedKey = await crypto.subtle.exportKey('raw', key);
        
        :', Array.from(new Uint8Array(exportedKey.slice(0, 8))));
      } catch (exportError) {
        
      }
      
      
      const stored = await secureStorage.get(['credentials', 'backupCID']);
      console.log('Storage result:', { 
        hasCredentials: !!stored.credentials, 
        credentialsType: typeof stored.credentials,
        hasBackupCID: !!stored.backupCID 
      });
      
      if (stored.credentials) {
        try {
          
          
          
          
          
          // Attempt decryption with detailed error logging
          let decrypted;
          try {
            decrypted = await decryptData(stored.credentials, key);
            
          } catch (decryptError) {
            console.error('Detailed decryption error:', {
              name: decryptError.name,
              message: decryptError.message,
              stack: decryptError.stack,
              constructor: decryptError.constructor.name
            });
            
            // Try to check if this is a key mismatch issue
            
            
            // Check if the stored data has the expected structure
            if (!stored.credentials.iv || !stored.credentials.data) {
              console.error('Stored credentials missing iv or data property');
              return { credentials: [], walletSeeds: [], error: 'Corrupted credential data structure' };
            }
            
            // Check IV length (should be 12 for AES-GCM)
            if (stored.credentials.iv.length !== 12) {
              console.error('Invalid IV length:', stored.credentials.iv.length, 'expected 12');
              return { credentials: [], walletSeeds: [], error: 'Invalid encryption format' };
            }
            
            throw decryptError;
          }
          
          const data = JSON.parse(decrypted);
          
          
          if (Array.isArray(data)) {
            
            return { credentials: data, walletSeeds: [] };
          } else if (data.credentials) {
            
            return {
              credentials: data.credentials,
              walletSeeds: data.walletSeeds || []
            };
          } else if (typeof data === 'object') {
            
            return { 
              credentials: [data], 
              walletSeeds: []
            };
          }
          
          
          return { credentials: [], walletSeeds: [] };
        } catch (decryptError) {
          console.error('Error decrypting credentials:', decryptError);
          console.error('Decryption error type:', decryptError.constructor.name);
          console.error('Decryption error message:', decryptError.message);
          console.error('Stored credentials structure for debugging:', stored.credentials);
          return { credentials: [], walletSeeds: [], error: 'Failed to decrypt credentials: ' + decryptError.message };
        }
      } else {
        
      }
    } catch (error) {
      console.error('Error retrieving credentials:', error);
      return { credentials: [], walletSeeds: [], error: error.message };
    }
    
    
    return { credentials: [], walletSeeds: [] };
  } catch (error) {
    console.error('Error retrieving credentials:', error);
    return { error: error.message };
  }
};

// Diagnostic function to help troubleshoot decryption issues
const diagnosticCheck = async (seedPhrase) => {
  try {
    
    
    // Check storage content
    const storage = await chrome.storage.local.get(null);
    );
    console.log('Storage structure:', {
      hasCredentials: !!storage.credentials,
      hasSeedPhrase: !!storage.hasSeedPhrase,
      hasEncryptedSeedPhrase: !!storage.encryptedSeedPhrase,
      hasPinCode: !!storage.pinCode,
      hasBackups: !!storage.backups
    });
    
    if (storage.credentials) {
      console.log('Credential structure:', {
        type: typeof storage.credentials,
        hasIv: !!storage.credentials.iv,
        hasData: !!storage.credentials.data,
        ivLength: storage.credentials.iv?.length,
        dataLength: storage.credentials.data?.length
      });
    }
    
    // Test key generation
    if (seedPhrase) {
      try {
        
        const bip39Module = await initBip39();
        const seed = await bip39Module.mnemonicToSeed(seedPhrase);
        
        
        const { encryptionKey } = await generateKeyFromSeedBytes(seed);
        
        
        // Test encryption/decryption with dummy data
        const testData = JSON.stringify({ test: 'data', timestamp: new Date().toISOString() });
        const encrypted = await encryptData(testData, encryptionKey);
        
        
        const decrypted = await decryptData(encrypted, encryptionKey);
        
        
      } catch (keyError) {
        console.error('Key generation/testing failed:', keyError);
      }
    }
    
    
    return { success: true, storage };
  } catch (error) {
    console.error('Diagnostic check failed:', error);
    return { success: false, error: error.message };
  }
};

// Session management functions
const createUserSession = (seedPhrase) => {
  currentUserSession = {
    seedPhrase,
    timestamp: Date.now(),
    isActive: true
  };
  
};

const isSessionValid = () => {
  if (!currentUserSession || !currentUserSession.isActive) {
    return false;
  }
  
  const now = Date.now();
  const sessionAge = now - currentUserSession.timestamp;
  
  if (sessionAge > sessionTimeout) {
    
    clearUserSession();
    return false;
  }
  
  return true;
};

const refreshUserSession = () => {
  if (currentUserSession && currentUserSession.isActive) {
    currentUserSession.timestamp = Date.now();
    
  }
};

const clearUserSession = () => {
  currentUserSession = null;
  currentStorageKey = null;
  
};

// Settings management functions
const saveSettings = async (settings) => {
  try {
    
    await secureStorage.set({ extensionSettings: settings });
    
    return true;
  } catch (error) {
    console.error('❌ Error saving settings:', error);
    return false;
  }
};

const getSettings = async () => {
  try {
    const result = await secureStorage.get(['extensionSettings']);
    return result.extensionSettings || {
      backup: { type: 'securesphere' },
      session: { timeout: 30 },
      autoLock: { onClose: true, onSleep: false },
      buildNumber: '1.0.0-' + Date.now()
    };
  } catch (error) {
    console.error('❌ Error loading settings:', error);
    return {
      backup: { type: 'securesphere' },
      session: { timeout: 30 },
      autoLock: { onClose: true, onSleep: false },
      buildNumber: '1.0.0-' + Date.now()
    };
  }
};

// Test SIA connection
const testSiaConnection = async (config) => {
  try {
    const { ip, port, password } = config;
    const authHeader = 'Basic ' + btoa(':' + password);
    const url = `http://${ip}:${port}/api/worker/objects/backup/`;
    
    
    
    // Use fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': authHeader },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.status === 200) {
      
      return { success: true };
    } else {
      
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (error) {
    console.error('❌ SIA connection error:', error);
    if (error.name === 'AbortError') {
      return { success: false, error: 'Connection timeout (10 seconds)' };
    }
    return { success: false, error: error.message };
  }
};

// Change PIN functionality
const changePin = async (currentPin, newPin) => {
  try {
    
    
    // First verify current PIN
    const verifyResult = await verifyPinCode(currentPin);
    if (!verifyResult.verified) {
      return { success: false, error: 'Current PIN is incorrect' };
    }
    
    // Get seed phrase from verified session
    const seedPhrase = verifyResult.seedPhrase;
    
    // Store new PIN with the same seed phrase
    const storeResult = await storePinCode(newPin, seedPhrase);
    if (!storeResult) {
      return { success: false, error: 'Failed to store new PIN' };
    }
    
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error changing PIN:', error);
    return { success: false, error: error.message };
  }
};

// Update session timeout
const updateSessionTimeout = async (timeout) => {
  try {
    sessionTimeout = timeout * 60 * 1000; // Convert minutes to milliseconds
    
    const settings = await getSettings();
    settings.session.timeout = timeout;
    await saveSettings(settings);
    
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating session timeout:', error);
    return { success: false, error: error.message };
  }
};

// Clear cache
const clearCache = async () => {
  try {
    // Clear temporary data but keep important stuff
    const itemsToKeep = [
      'credentials', 
      'pinCode', 
      'encryptedSeedPhrase', 
      'storedSeedPhrase',
      'extensionSettings',
      'backups'
    ];
    
    // Get all storage items
    const allItems = await new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (items) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(items);
        }
      });
    });
    
    // Remove items not in keep list
    const itemsToRemove = Object.keys(allItems).filter(key => !itemsToKeep.includes(key));
    
    if (itemsToRemove.length > 0) {
      await new Promise((resolve, reject) => {
        chrome.storage.local.remove(itemsToRemove, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    }
    
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    return { success: false, error: error.message };
  }
};

// Reset all data
const resetAllData = async () => {
  try {
    
    
    // Clear all storage
    await new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
    
    // Clear session state
    clearUserSession();
    
    // Reset first time setup flag
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ firstTimeSetup: true }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
    
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error resetting data:', error);
    return { success: false, error: error.message };
  }
};

// Sync data (now with actual SIA backup implementation)
const syncData = async () => {
  try {
    
    
    // Get current settings to check backup configuration
    const settings = await getSettings();
    
    if (settings.backup.type === 'securesphere') {
      // Use SecureSphere decentralized server
      
      // Implementation would go here (similar to mobile app's S5 upload)
      return { success: true, message: 'SecureSphere sync not yet implemented' };
    } else if (settings.backup.type === 'sia') {
      // Use self-hosted SIA node
      
      
      // Create backup data structure
      const backupData = await createBackupData();
      
      // Upload to SIA node
      const uploadResult = await uploadToSiaNode(backupData);
      
      if (uploadResult.success) {
        
        return { 
          success: true, 
          message: `Backup uploaded successfully to SIA node`,
          fileName: uploadResult.fileName 
        };
      } else {
        throw new Error('SIA upload failed');
      }
    } else {
      // Local only
      
      return { success: true, message: 'Local storage only - no cloud sync' };
    }
  } catch (error) {
    console.error('❌ Error syncing data:', error);
    return { success: false, error: error.message };
  }
};

// Get or generate consistent user ID
const getUserId = async () => {
  try {
    const result = await secureStorage.get(['userId']);
    if (result.userId) {
      return result.userId;
    }
    
    // Generate new user ID based on current timestamp and random values
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await secureStorage.set({ userId });
    
    return userId;
  } catch (error) {
    console.error('❌ Error getting user ID:', error);
    // Fallback to timestamp-based ID
    return `user_${Date.now()}`;
  }
};

// Upload backup to SIA node
const uploadToSiaNode = async (backupData, customName = null) => {
  try {
    
    
    // Get SIA configuration from settings
    const settings = await getSettings();
    if (!settings.backup || settings.backup.type !== 'sia') {
      throw new Error('SIA backup not configured');
    }
    
    const { ip, port, password } = settings.backup;
    if (!ip || !port || !password) {
      throw new Error('Missing SIA node configuration (IP, port, or password)');
    }
    
    
    
    // Get consistent user ID
    const userId = await getUserId();
    const fileName = customName || `backup_${Date.now()}.json`;
    const url = `http://${ip}:${port}/api/worker/objects/backup/${userId}/${fileName}`;
    
    
    
    // Prepare authentication header
    const authString = ':' + password;
    const authHeader = 'Basic ' + btoa(authString);
    
    
    // Prepare backup data
    const jsonBody = JSON.stringify(backupData);
    
    
    // Upload to SIA node
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: jsonBody,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    
    
    if (response.status !== 200) {
      const responseText = await response.text();
      
      throw new Error(`[SIA] Upload failed: ${response.status} - ${responseText}`);
    }
    
    
    return { success: true, fileName, url, userId };
  } catch (error) {
    console.error('⚠️ [SIA] Upload failed:', error);
    if (error.name === 'AbortError') {
      throw new Error('[SIA] Upload timeout (30 seconds)');
    }
    throw error;
  }
};

// List backups from SIA node
const listSiaBackups = async () => {
  try {
    
    
    // Get SIA configuration from settings
    const settings = await getSettings();
    if (!settings.backup || settings.backup.type !== 'sia') {
      throw new Error('SIA backup not configured');
    }
    
    const { ip, port, password } = settings.backup;
    if (!ip || !port || !password) {
      throw new Error('Missing SIA node configuration');
    }
    
    // Get consistent user ID
    const userId = await getUserId();
    const url = `http://${ip}:${port}/api/worker/objects/backup/${userId}/`;
    
    
    
    // Prepare authentication header
    const authString = ':' + password;
    const authHeader = 'Basic ' + btoa(authString);
    
    // Fetch backup list
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.status !== 200) {
      const responseText = await response.text();
      
      throw new Error(`[SIA] Failed to list backups: ${response.status}`);
    }
    
    const backups = await response.json();
    
    
    // Format backups to match expected structure
    return backups.map(item => ({
      date: item.modTime || '',
      name: item.eTag || item.name || '',
      path: item.name || '',
      size: item.size || 0,
      mimeType: item.mimeType || '',
      source: 'sia'
    }));
  } catch (error) {
    console.error('⚠️ [SIA] List backups failed:', error);
    if (error.name === 'AbortError') {
      throw new Error('[SIA] List timeout (10 seconds)');
    }
    throw error;
  }
};

// Restore backup from SIA node
const restoreFromSiaNode = async (backupPath) => {
  try {
    
    
    // Get SIA configuration from settings
    const settings = await getSettings();
    if (!settings.backup || settings.backup.type !== 'sia') {
      throw new Error('SIA backup not configured');
    }
    
    const { ip, port, password } = settings.backup;
    if (!ip || !port || !password) {
      throw new Error('Missing SIA node configuration');
    }
    
    // Build restore URL
    const url = `http://${ip}:${port}/api/worker/objects${backupPath}`;
    
    
    // Prepare authentication header
    const authString = ':' + password;
    const authHeader = 'Basic ' + btoa(authString);
    
    // Fetch backup data
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.status !== 200) {
      const responseText = await response.text();
      
      throw new Error(`[SIA] Failed to restore backup: ${response.status} - ${responseText}`);
    }
    
    const backupData = await response.json();
    
    
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('[SIA] Invalid backup data format');
    }
    
    
    return backupData;
  } catch (error) {
    console.error('⚠️ [SIA] Restore failed:', error);
    if (error.name === 'AbortError') {
      throw new Error('[SIA] Restore timeout (30 seconds)');
    }
    throw error;
  }
};

// Create backup data structure (matches mobile app format)
const createBackupData = async () => {
  try {
    
    
    // Get current user session
    if (!currentUserSession || !currentUserSession.seedPhrase) {
      throw new Error('No active user session');
    }
    
    // Get all credentials
    const credentialsResult = await getCredentials(currentUserSession.seedPhrase);
    const credentials = credentialsResult.credentials || [];
    
    // Format credentials for backup (similar to mobile app)
    const backupCredentials = credentials.map(cred => ({
      id: cred.id || Date.now().toString(),
      title: cred.website || cred.name || 'Untitled',
      username: cred.username || '',
      password: cred.password || '',
      seedPhrase: cred.seedPhrase || '',
      category: cred.type || 'Other',
      notes: cred.notes || '',
      createdAt: cred.timestamp || new Date().toISOString(),
      updatedAt: cred.timestamp || new Date().toISOString(),
      type: cred.type || 'login'
    }));
    
    // Get consistent user ID
    const userId = await getUserId();
    
    // Create backup data structure matching mobile app
    const backupData = {
      timestamp: new Date().toISOString(),
      appVersion: '1.0.0',
      passwords: backupCredentials,
      userId: userId,
    };
    
    
    return backupData;
  } catch (error) {
    console.error('❌ Error creating backup data:', error);
    throw error;
  }
};

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

// Message handling from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Simple ping to check if background service is ready
  if (message.type === 'PING') {
    sendResponse({ success: true, initialized: isInitialized });
    return true;
  }

  // ============================================================================
  // AUTHENTICATION HANDLERS - Using New Modular Controllers
  // ============================================================================
  
  if (message.type === 'STORE_PIN') {
    authController.handleStorePin(message, sendResponse);
    return true;
  }

  if (message.type === 'VERIFY_PIN') {
    authController.handleVerifyPin(message, sendResponse);
    return true;
  }

  if (message.type === 'VERIFY_SEED_PHRASE_LOGIN') {
    authController.handleVerifySeedPhraseLogin(message, sendResponse);
    return true;
  }

  if (message.type === 'CHECK_LOGIN_STATUS') {
    authController.handleCheckLoginStatus(message, sendResponse);
    return true;
  }

  if (message.type === 'LOGOUT') {
    authController.handleLogout(message, sendResponse);
    return true;
  }

  if (message.type === 'GENERATE_SEED') {
    authController.handleGenerateSeed(message, sendResponse);
    return true;
  }

  if (message.type === 'CHANGE_PIN') {
    authController.handleChangePin(message, sendResponse);
    return true;
  }

  if (message.type === 'REGISTER_USER') {
    authController.handleRegisterUser(message, sendResponse);
    return true;
  }

  if (message.type === 'REFRESH_SESSION') {
    authController.handleRefreshSession(message, sendResponse);
    return true;
  }

  if (message.type === 'UPDATE_SESSION_TIMEOUT') {
    authController.handleUpdateSessionTimeout(message, sendResponse);
    return true;
  }

  if (message.type === 'GET_SESSION_INFO') {
    authController.handleGetSessionInfo(message, sendResponse);
    return true;
  }

  // ============================================================================
  // PASSWORD MANAGEMENT HANDLERS - Using New Modular Controllers
  // ============================================================================
  
  if (message.type === 'STORE_CREDENTIALS') {
    passwordController.handleStoreCredentials(message, sendResponse);
    return true;
  }

  if (message.type === 'GET_CREDENTIALS') {
    passwordController.handleGetCredentials(message, sendResponse);
    return true;
  }

  if (message.type === 'CREATE_BACKUP') {
    passwordController.handleCreateBackup(message, sendResponse);
    return true;
  }

  if (message.type === 'GET_BACKUPS') {
    passwordController.handleGetBackups(message, sendResponse);
    return true;
  }

  if (message.type === 'RESTORE_BACKUP') {
    passwordController.handleRestoreBackup(message, sendResponse);
    return true;
  }

  if (message.type === 'GENERATE_PASSWORD') {
    passwordController.handleGeneratePassword(message, sendResponse);
    return true;
  }

  if (message.type === 'VALIDATE_CREDENTIAL') {
    passwordController.handleValidateCredential(message, sendResponse);
    return true;
  }

  if (message.type === 'SEARCH_CREDENTIALS') {
    passwordController.handleSearchCredentials(message, sendResponse);
    return true;
  }

  if (message.type === 'EXPORT_CREDENTIALS') {
    passwordController.handleExportCredentials(message, sendResponse);
    return true;
  }

  if (message.type === 'IMPORT_CREDENTIALS') {
    passwordController.handleImportCredentials(message, sendResponse);
    return true;
  }

  // ============================================================================
  // BREACH MONITORING HANDLERS - Using Existing Modular Controller
  // ============================================================================
  
  if (message.type === 'BREACH_CHECK_EMAIL') {
    breachController.handleBreachCheck(message, sendResponse);
    return true;
  }

  if (message.type === 'BREACH_GET_REPORTS') {
    breachController.handleGetReports(message, sendResponse);
    return true;
  }

  if (message.type === 'BREACH_MONITOR_TOGGLE') {
    breachController.handleToggleMonitoring(message, sendResponse);
    return true;
  }

  // ============================================================================
  // LEGACY COMPATIBILITY HANDLERS (Redirect to new controllers)
  // ============================================================================
  
  if (message.type === 'CREATE_WALLET' || message.type === 'GENERATE_SEED_PHRASE') {
    // Redirect to new auth controller
    authController.handleGenerateSeed(message, sendResponse);
    return true;
  }

  // ============================================================================
  // CRYPTO & KEY GENERATION HANDLERS (Keep existing implementation)
  // ============================================================================

  if (message.type === 'GENERATE_KEYS') {
    (async () => {
      try {
        if (!message.seedPhrase) {
          throw new Error('Seed phrase is required');
        }
        
        const bip39Module = await initBip39();
        const seed = await bip39Module.mnemonicToSeed(message.seedPhrase);
        const { encryptionKey, privateKey, publicKey } = await generateKeyFromSeedBytes(seed);
        
        const rawKey = await crypto.subtle.exportKey('raw', encryptionKey);

        sendResponse({
          success: true,
          rawKey: rawKey,
          privateKey,
          publicKey
        });
      } catch (error) {
        console.error('Error generating keys:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    return true;
  }

  // ============================================================================
  // EXTERNAL AUTH HANDLERS (Keep existing secure-auth integration)
  // ============================================================================

  if (message.type === 'VERIFY_USER') {
    (async () => {
      try {
        if (!message.seedPhrase) {
          throw new Error('Seed phrase is required for verification');
        }
        
        const result = await secureAuth.verifyUser(message.seedPhrase);
        
        sendResponse({
          success: true,
          uuid: result.uuid,
          publicKey: result.publicKey,
          serverData: result.serverData
        });
      } catch (error) {
        console.error('Error verifying user:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    return true;
  }

  if (message.type === 'CHECK_REGISTRATION_STATUS') {
    (async () => {
      try {
        const status = await secureAuth.isUserRegistered();
        sendResponse({
          success: true,
          ...status
        });
      } catch (error) {
        console.error('Error checking registration status:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    return true;
  }

  // ============================================================================
  // LEGACY HANDLERS TO BE DEPRECATED (Keeping for backward compatibility)
  // ============================================================================

  // Note: These handlers will be phased out as they're now handled by modular controllers
  // Keeping them temporarily for backward compatibility during transition
  
  if (message.type === 'DIAGNOSTIC_CHECK') {
    (async () => {
      try {
        const result = await diagnosticCheck(message.seedPhrase);
        sendResponse(result);
      } catch (error) {
        console.error('Diagnostic check failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // ============================================================================
  // SETTINGS HANDLERS (Keep existing implementation)
  // ============================================================================

  if (message.type === 'GET_SETTINGS') {
    (async () => {
      try {
        const settings = await getSettings();
        sendResponse({ success: true, settings });
      } catch (error) {
        console.error('Error getting settings:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'SAVE_BACKUP_SETTINGS') {
    (async () => {
      try {
        const settings = await getSettings();
        settings.backup = message.config;
        const saveResult = await saveSettings(settings);
        
        if (saveResult) {
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Failed to save settings' });
        }
      } catch (error) {
        console.error('Error saving backup settings:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'TEST_SIA_CONNECTION') {
    (async () => {
      try {
        const result = await testSiaConnection(message.config);
        sendResponse(result);
      } catch (error) {
        console.error('Error testing SIA connection:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'UPDATE_AUTO_LOCK_SETTINGS') {
    (async () => {
      try {
        const settings = await getSettings();
        settings.autoLock = {
          onClose: message.lockOnClose,
          onSleep: message.lockOnSleep
        };
        const saveResult = await saveSettings(settings);
        
        if (saveResult) {
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Failed to save auto-lock settings' });
        }
      } catch (error) {
        console.error('Error updating auto-lock settings:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'SYNC_DATA') {
    (async () => {
      try {
        const result = await syncData();
        sendResponse(result);
      } catch (error) {
        console.error('Error syncing data:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // ============================================================================
  // SIA BACKUP HANDLERS (Keep existing implementation)
  // ============================================================================

  if (message.type === 'UPLOAD_TO_SIA') {
    (async () => {
      try {
        const result = await uploadToSiaNode(message.backupData, message.customName);
        sendResponse(result);
      } catch (error) {
        console.error('Error uploading to SIA:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'LIST_SIA_BACKUPS') {
    (async () => {
      try {
        const result = await listSiaBackups();
        sendResponse(result);
      } catch (error) {
        console.error('Error listing SIA backups:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'RESTORE_FROM_SIA') {
    (async () => {
      try {
        const result = await restoreFromSiaNode(message.backupPath);
        sendResponse(result);
      } catch (error) {
        console.error('Error restoring from SIA:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // ============================================================================
  // CACHE & DATA MANAGEMENT HANDLERS (Keep existing implementation)
  // ============================================================================

  if (message.type === 'CLEAR_CACHE') {
    (async () => {
      try {
        const result = await clearCache();
        sendResponse(result);
      } catch (error) {
        console.error('Error clearing cache:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'RESET_ALL_DATA') {
    (async () => {
      try {
        const result = await resetAllData();
        sendResponse(result);
      } catch (error) {
        console.error('Error resetting data:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Default handler for unknown message types
  
  sendResponse({ success: false, error: 'Unknown message type: ' + message.type });
}); 
