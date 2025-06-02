/**
 * Backup Service
 * Core backup operations for SecureSphere Extension
 */

import { ENV } from '../config/env-loader.js';

export class BackupService {
  constructor() {
    this.settings = null;
  }

  /**
   * Load current settings
   */
  async loadSettings() {
    if (!this.settings) {
      this.settings = await chrome.storage.local.get(['settings']) || {};
    }
    return this.settings;
  }

  /**
   * Create a comprehensive backup of user data
   * @param {string} seedPhrase - User's seed phrase
   * @param {Object} options - Backup options
   */
  async createBackup(seedPhrase, options = {}) {
    try {
      if (!seedPhrase) {
        throw new Error('Seed phrase is required for backup creation');
      }

      // Get all stored data
      const storage = await chrome.storage.local.get(null);
      const { passwords = [], walletSeeds = [] } = storage;

      // Get all credentials (if available)
      let credentials = [];
      try {
        if (typeof getCredentials === 'function') {
          const credentialsResult = await getCredentials(seedPhrase);
          credentials = credentialsResult.credentials || [];
        }
      } catch (error) {
        console.warn('Could not retrieve credentials for backup:', error);
      }

      // Format credentials for backup
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

      // Get user ID consistently
      const userId = await this.getUserId();

      // Create comprehensive backup data
      const backupData = {
        // Metadata
        version: '1.2.0',
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        userId: userId,
        
        // Legacy format support
        passwords: passwords,
        walletSeeds: walletSeeds,
        
        // Enhanced format
        credentials: backupCredentials,
        
        // Backup settings
        settings: {
          encryption: options.encryption || 'AES-256-GCM',
          iterations: options.iterations || 100000
        },
        
        // Metadata
        meta: {
          source: 'SecureSphere-Extension',
          platform: 'Browser',
          total_items: backupCredentials.length,
          backup_type: options.type || 'full'
        }
      };

      return backupData;
    } catch (error) {
      console.error('❌ [BackupService] Create backup failed:', error);
      throw error;
    }
  }

  /**
   * Restore backup data
   * @param {Object} backupData - Backup data to restore
   * @param {string} seedPhrase - User's seed phrase
   */
  async restoreBackup(backupData, seedPhrase) {
    try {
      if (!backupData || typeof backupData !== 'object') {
        throw new Error('Invalid backup data format');
      }

      // Restore legacy format
      if (backupData.passwords || backupData.walletSeeds) {
        await chrome.storage.local.set({
          passwords: backupData.passwords || [],
          walletSeeds: backupData.walletSeeds || []
        });
      }

      // Restore enhanced format
      if (backupData.credentials && Array.isArray(backupData.credentials)) {
        // Store credentials using the password service if available
        try {
          for (const credential of backupData.credentials) {
            // Convert back to internal format
            const internalCred = {
              id: credential.id,
              website: credential.title,
              name: credential.title,
              username: credential.username,
              password: credential.password,
              seedPhrase: credential.seedPhrase,
              type: credential.category || credential.type,
              notes: credential.notes,
              timestamp: credential.createdAt
            };

            // Store using appropriate service
            if (typeof storeCredential === 'function') {
              await storeCredential(internalCred, seedPhrase);
            }
          }
        } catch (error) {
          console.warn('Could not restore credentials:', error);
        }
      }

      // Record backup restoration
      await this.createBackupRecord(backupData.credentials?.length || 0, 'restore');

      return {
        restored: true,
        itemCount: backupData.credentials?.length || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [BackupService] Restore backup failed:', error);
      throw error;
    }
  }

  /**
   * Export backup as downloadable file
   * @param {string} seedPhrase - User's seed phrase
   */
  async exportBackup(seedPhrase) {
    try {
      const backupData = await this.createBackup(seedPhrase);
      const backupString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([backupString], { type: 'application/json' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `securesphere-backup-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return {
        exported: true,
        size: blob.size,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [BackupService] Export backup failed:', error);
      throw error;
    }
  }

  /**
   * Import backup from file
   * @param {File} backupFile - Backup file to import
   * @param {string} seedPhrase - User's seed phrase
   */
  async importBackup(backupFile, seedPhrase) {
    try {
      const text = await backupFile.text();
      const backupData = JSON.parse(text);
      
      const result = await this.restoreBackup(backupData, seedPhrase);
      
      return {
        imported: true,
        ...result
      };
    } catch (error) {
      console.error('❌ [BackupService] Import backup failed:', error);
      throw error;
    }
  }

  /**
   * Save backup settings
   * @param {Object} settings - Backup settings
   */
  async saveBackupSettings(settings) {
    try {
      const currentSettings = await chrome.storage.local.get(['settings']);
      const updatedSettings = {
        ...currentSettings.settings,
        backup: settings
      };

      await chrome.storage.local.set({ settings: updatedSettings });
      this.settings = { settings: updatedSettings };

      return {
        saved: true,
        settings: settings,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [BackupService] Save backup settings failed:', error);
      throw error;
    }
  }

  /**
   * Create backup record for tracking
   * @param {number} credentialCount - Number of credentials backed up
   * @param {string} operation - Operation type (create, restore)
   */
  async createBackupRecord(credentialCount, operation = 'create') {
    try {
      const record = {
        timestamp: Date.now(),
        credentialCount: credentialCount,
        operation: operation,
        version: '1.2.0'
      };

      // Store backup record
      const records = await chrome.storage.local.get(['backupRecords']);
      const backupRecords = records.backupRecords || [];
      backupRecords.push(record);

      // Keep only last 50 records
      if (backupRecords.length > 50) {
        backupRecords.splice(0, backupRecords.length - 50);
      }

      await chrome.storage.local.set({ backupRecords });
      
      return record;
    } catch (error) {
      console.error('❌ [BackupService] Create backup record failed:', error);
      throw error;
    }
  }

  /**
   * Get consistent user ID
   */
  async getUserId() {
    try {
      let userIdData = await chrome.storage.local.get(['userId']);
      
      if (!userIdData.userId) {
        // Generate new user ID
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await chrome.storage.local.set({ userId });
        return userId;
      }
      
      return userIdData.userId;
    } catch (error) {
      console.error('❌ [BackupService] Get user ID failed:', error);
      return 'user_' + Date.now();
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats() {
    try {
      const records = await chrome.storage.local.get(['backupRecords']);
      const backupRecords = records.backupRecords || [];
      
      const lastBackup = backupRecords.length > 0 ? backupRecords[backupRecords.length - 1] : null;
      const totalBackups = backupRecords.filter(r => r.operation === 'create').length;
      const totalRestores = backupRecords.filter(r => r.operation === 'restore').length;

      return {
        totalBackups,
        totalRestores,
        lastBackup: lastBackup ? new Date(lastBackup.timestamp).toISOString() : null,
        recordCount: backupRecords.length
      };
    } catch (error) {
      console.error('❌ [BackupService] Get backup stats failed:', error);
      return { totalBackups: 0, totalRestores: 0, lastBackup: null, recordCount: 0 };
    }
  }
} 