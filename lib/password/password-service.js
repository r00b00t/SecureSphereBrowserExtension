// Password Management Service
// Handles credential storage, retrieval, encryption, and management operations

import * as bip39 from 'bip39';
import { encryptData, decryptData } from './index.js';
import { generateKeyFromSeedBytes } from '../key/index.js';
import { authService } from '../auth/auth-service.js';
import { ENV } from '../config/environment.js';

export class PasswordService {
  constructor() {
    this.isDebugEnabled = ENV.isDebugEnabled();
    this.maxCredentials = 10000; // Configurable limit
  }

  /**
   * Store credentials securely in local storage
   * @param {Array} credentials - Array of credential objects
   * @param {string} seedPhrase - User's seed phrase
   * @param {string} timestamp - Optional timestamp
   * @param {number} retryCount - Retry attempt count
   * @returns {Promise<Object>} Storage result
   */
  async storeCredentials(credentials, seedPhrase, timestamp = null, retryCount = 0) {
    try {
      if (!chrome.storage || !chrome.storage.local) {
        throw new Error('Chrome storage API not available');
      }

      const seed = await bip39.mnemonicToSeed(seedPhrase);
      const { encryptionKey: key } = await generateKeyFromSeedBytes(seed);
      
      const dataToStore = {
        credentials,
        timestamp: timestamp || new Date().toISOString()
      };

      const encrypted = await encryptData(JSON.stringify(dataToStore), key);
      
      try {
        const secureStorage = authService.getSecureStorage();
        await secureStorage.set({
          credentials: encrypted,
          hasSeedPhrase: true
        });
      } catch (storageError) {
        console.error('❌ [PASSWORD] Storage error occurred:', storageError);
        if (retryCount < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return this.storeCredentials(credentials, seedPhrase, timestamp, retryCount + 1);
        }
        throw storageError;
      }
      
      try {
        await this.createBackupRecord(credentials.length);
      } catch (backupError) {
        console.error('⚠️ [PASSWORD] Local backup tracking failed:', backupError);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ [PASSWORD] Error storing credentials:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieve credentials using seed phrase
   * @param {string} seedPhrase - User's seed phrase
   * @param {number} retryCount - Retry attempt count
   * @returns {Promise<Object>} Retrieved credentials
   */
  async getCredentials(seedPhrase, retryCount = 0) {
    try {
      if (this.isDebugEnabled) {
        
      }
      
      if (!chrome.storage || !chrome.storage.local) {
        throw new Error('Chrome storage API not available');
      }

      if (!seedPhrase) {
        
        try {
          const secureStorage = authService.getSecureStorage();
          const result = await secureStorage.get(['credentials']);
          
          if (!result || !result.credentials) {
            
            return { credentials: [], walletSeeds: [], error: 'No credentials found' };
          }
          return { credentials: result.credentials, walletSeeds: result.walletSeeds || [] };
        } catch (storageError) {
          console.error('❌ [PASSWORD] Error accessing storage:', storageError);
          return { credentials: [], walletSeeds: [], error: storageError.message || 'Failed to access storage' };
        }
      }

      try {
        // Validate seed phrase
        if (!this.validateSeedPhrase(seedPhrase)) {
          console.error('❌ [PASSWORD] Invalid seed phrase format');
          return { credentials: [], walletSeeds: [], error: 'Invalid seed phrase' };
        }
        
        // Generate encryption key
        const seed = await bip39.mnemonicToSeed(seedPhrase);
        const { encryptionKey: key } = await generateKeyFromSeedBytes(seed);
        
        if (this.isDebugEnabled) {
          
        }
        
        // Fetch stored credentials with secure storage
        const secureStorage = authService.getSecureStorage();
        const stored = await secureStorage.get(['credentials', 'backupCID']);
        
        if (this.isDebugEnabled) {
          
        }
        
        if (stored.credentials) {
          try {
            // Decrypt stored credentials
            const decrypted = await decryptData(stored.credentials, key);
            const data = JSON.parse(decrypted);
            
            if (this.isDebugEnabled) {
              
            }
            
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
            console.error('❌ [PASSWORD] Error decrypting credentials:', decryptError);
            return { credentials: [], walletSeeds: [], error: 'Failed to decrypt credentials: ' + decryptError.message };
          }
        } else {
          
        }
      } catch (error) {
        console.error('❌ [PASSWORD] Error retrieving credentials:', error);
        return { credentials: [], walletSeeds: [], error: error.message };
      }
      
      return { credentials: [], walletSeeds: [] };
    } catch (error) {
      console.error('❌ [PASSWORD] Error retrieving credentials:', error);
      return { error: error.message };
    }
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
      console.error('❌ [PASSWORD-SERVICE] Seed phrase validation error:', error);
      return false;
    }
  }

  /**
   * Create backup record
   * @param {number} credentialCount - Number of credentials
   * @returns {Promise<void>}
   */
  async createBackupRecord(credentialCount) {
    try {
      const secureStorage = authService.getSecureStorage();
      const backupResult = await secureStorage.get(['backups']);
      const backups = backupResult.backups || [];
      const newBackup = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        credentialCount
      };
      const updatedBackups = [newBackup, ...backups].slice(0, 10);
      await secureStorage.set({ 
        backups: updatedBackups,
        currentBackupId: newBackup.id
      });
      
    } catch (error) {
      console.error('❌ [PASSWORD] Failed to create backup record:', error);
      throw error;
    }
  }

  /**
   * Get list of available backups
   * @returns {Promise<Array>} Array of backup objects
   */
  async getBackups() {
    try {
      const { backups = [] } = await chrome.storage.local.get(['backups']);
      return backups;
    } catch (error) {
      console.error('❌ [PASSWORD] Error getting backups:', error);
      return [];
    }
  }

  /**
   * Restore from a specific backup
   * @param {string} backupId - Backup ID to restore
   * @param {string} seedPhrase - User's seed phrase
   * @returns {Promise<Object>} Restore result
   */
  async restoreFromBackup(backupId, seedPhrase) {
    try {
      const seed = await bip39.mnemonicToSeed(seedPhrase);
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
      
      return { success: true, credentials: data.credentials };
    } catch (error) {
      console.error('❌ [PASSWORD] Error restoring from backup:', error);
      return { success: false, error: 'Failed to restore from backup: ' + error.message };
    }
  }

  /**
   * Generate password with options
   * @param {number} length - Password length
   * @param {Object} options - Password generation options
   * @returns {string} Generated password
   */
  generatePassword(length = 12, options = {}) {
    let chars = '';
    if (options.uppercase !== false) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (options.lowercase !== false) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (options.numbers !== false) chars += '0123456789';
    if (options.symbols === true) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';

    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Validate credential object
   * @param {Object} credential - Credential to validate
   * @returns {Object} Validation result
   */
  validateCredential(credential) {
    const errors = [];
    
    if (!credential || typeof credential !== 'object') {
      return { valid: false, errors: ['Credential must be an object'] };
    }

    if (credential.type === 'wallet') {
      if (!credential.name || credential.name.trim().length === 0) {
        errors.push('Wallet name is required');
      }
      if (!credential.seedPhrase || credential.seedPhrase.trim().length === 0) {
        errors.push('Wallet seed phrase is required');
      }
    } else {
      // Default to login type
      if (!credential.website || credential.website.trim().length === 0) {
        errors.push('Website is required');
      }
      if (!credential.username || credential.username.trim().length === 0) {
        errors.push('Username is required');
      }
      if (!credential.password || credential.password.trim().length === 0) {
        errors.push('Password is required');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Search credentials
   * @param {Array} credentials - Credentials to search
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @returns {Array} Filtered credentials
   */
  searchCredentials(credentials, query = '', filters = {}) {
    if (!Array.isArray(credentials)) return [];
    
    let results = credentials;

    // Apply text search
    if (query.trim()) {
      const searchTerm = query.toLowerCase();
      results = results.filter(cred => {
        const searchFields = [
          cred.website || '',
          cred.username || '',
          cred.name || '',
          cred.notes || ''
        ].join(' ').toLowerCase();
        
        return searchFields.includes(searchTerm);
      });
    }

    // Apply type filter
    if (filters.type) {
      results = results.filter(cred => (cred.type || 'login') === filters.type);
    }

    // Apply date range filter
    if (filters.startDate || filters.endDate) {
      results = results.filter(cred => {
        if (!cred.timestamp) return false;
        const credDate = new Date(cred.timestamp);
        if (filters.startDate && credDate < new Date(filters.startDate)) return false;
        if (filters.endDate && credDate > new Date(filters.endDate)) return false;
        return true;
      });
    }

    return results;
  }

  /**
   * Export credentials in specified format
   * @param {string} seedPhrase - User's seed phrase
   * @param {string} format - Export format (json, csv)
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportCredentials(seedPhrase, format = 'json', options = {}) {
    try {
      const credentialsResult = await this.getCredentials(seedPhrase);
      const credentials = credentialsResult.credentials || [];

      if (format === 'json') {
        const exportData = {
          exported: new Date().toISOString(),
          version: '1.0',
          credentials: credentials.map(cred => ({
            ...cred,
            // Optionally exclude sensitive data in export
            ...(options.excludePasswords ? { password: '[HIDDEN]', seedPhrase: '[HIDDEN]' } : {})
          }))
        };

        return {
          success: true,
          data: JSON.stringify(exportData, null, 2),
          filename: `securesphere-backup-${Date.now()}.json`,
          mimeType: 'application/json'
        };
      } else if (format === 'csv') {
        // CSV export implementation
        const headers = ['Type', 'Website', 'Username', 'Password', 'Name', 'Created'];
        const rows = credentials.map(cred => [
          cred.type || 'login',
          cred.website || '',
          cred.username || '',
          options.excludePasswords ? '[HIDDEN]' : (cred.password || ''),
          cred.name || '',
          cred.timestamp || ''
        ]);

        const csvContent = [headers, ...rows]
          .map(row => row.map(field => `"${field}"`).join(','))
          .join('\n');

        return {
          success: true,
          data: csvContent,
          filename: `securesphere-backup-${Date.now()}.csv`,
          mimeType: 'text/csv'
        };
      } else {
        throw new Error('Unsupported export format: ' + format);
      }
    } catch (error) {
      console.error('❌ [PASSWORD] Error exporting credentials:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Import credentials from data
   * @param {string} data - Import data
   * @param {string} seedPhrase - User's seed phrase
   * @param {string} format - Import format
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importCredentials(data, seedPhrase, format = 'json', options = {}) {
    try {
      let importedCredentials = [];

      if (format === 'json') {
        const parsed = JSON.parse(data);
        importedCredentials = parsed.credentials || parsed.passwords || [];
      } else {
        throw new Error('Unsupported import format: ' + format);
      }

      // Validate imported credentials
      const validCredentials = importedCredentials.filter(cred => {
        const validation = this.validateCredential(cred);
        return validation.valid;
      });

      if (validCredentials.length === 0) {
        throw new Error('No valid credentials found in import data');
      }

      // Get existing credentials
      const existingResult = await this.getCredentials(seedPhrase);
      const existingCredentials = existingResult.credentials || [];

      // Merge credentials (append or replace based on options)
      let finalCredentials;
      if (options.replace) {
        finalCredentials = validCredentials;
      } else {
        finalCredentials = [...existingCredentials, ...validCredentials];
      }

      // Store merged credentials
      const storeResult = await this.storeCredentials(finalCredentials, seedPhrase);
      
      if (storeResult.success) {
        return {
          success: true,
          imported: validCredentials.length,
          total: finalCredentials.length,
          skipped: importedCredentials.length - validCredentials.length
        };
      } else {
        throw new Error(storeResult.error || 'Failed to store imported credentials');
      }
    } catch (error) {
      console.error('❌ [PASSWORD] Error importing credentials:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get credential statistics
   * @param {Array} credentials - Array of credentials
   * @returns {Object} Statistics object
   */
  getCredentialStatistics(credentials) {
    if (!Array.isArray(credentials)) {
      return {
        totalCredentials: 0,
        loginCredentials: 0,
        walletCredentials: 0,
        lastUpdated: null
      };
    }

    const stats = {
      totalCredentials: credentials.length,
      loginCredentials: credentials.filter(c => (c.type || 'login') === 'login').length,
      walletCredentials: credentials.filter(c => c.type === 'wallet').length,
      lastUpdated: null
    };

    // Find most recent timestamp
    const timestamps = credentials
      .map(c => c.timestamp)
      .filter(t => t)
      .map(t => new Date(t))
      .sort((a, b) => b - a);

    if (timestamps.length > 0) {
      stats.lastUpdated = timestamps[0].toISOString();
    }

    return stats;
  }

  /**
   * Create backup data structure
   * @param {string} seedPhrase - User's seed phrase
   * @returns {Promise<Object>} Backup data
   */
  async createBackup(seedPhrase) {
    try {
      const credentialsResult = await this.getCredentials(seedPhrase);
      const credentials = credentialsResult.credentials || [];

      const backupData = {
        timestamp: new Date().toISOString(),
        appVersion: '1.0.0',
        credentials: credentials,
        credentialCount: credentials.length
      };

      return { success: true, data: backupData };
    } catch (error) {
      console.error('❌ [PASSWORD] Error creating backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get maximum allowed credentials
   * @returns {number} Maximum credentials limit
   */
  getMaxCredentials() {
    return this.maxCredentials;
  }

  /**
   * Check if encryption is enabled
   * @returns {boolean} Whether encryption is enabled
   */
  isEncryptionEnabled() {
    return true; // Always enabled in this implementation
  }

  /**
   * Check if backup is enabled
   * @returns {boolean} Whether backup is enabled
   */
  isBackupEnabled() {
    return ENV.isFeatureEnabled('SIA_BACKUP') || ENV.isFeatureEnabled('CLOUD_SYNC');
  }
}

// Create and export singleton instance
export const passwordService = new PasswordService(); 
