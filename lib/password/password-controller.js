// Password Management Controller
// Handles background password/credential operations and message handling

import { passwordService } from './password-service.js';
import { authService } from '../auth/auth-service.js';
import { ENV } from '../config/environment.js';

export class PasswordController {
  constructor() {
    this.setupMessageHandlers();
    this.isDebugEnabled = ENV.isDebugEnabled();
  }

  /**
   * Set up chrome runtime message handlers for password management
   */
  setupMessageHandlers() {
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'STORE_CREDENTIALS':
          return await this.handleStoreCredentials(message);
        
        case 'GET_CREDENTIALS':
          return await this.handleGetCredentials(message);
        
        case 'CREATE_BACKUP':
          return await this.handleCreateBackup(message);
        
        case 'GET_BACKUPS':
          return await this.handleGetBackups(message);
        
        case 'RESTORE_BACKUP':
          return await this.handleRestoreBackup(message);
        
        case 'GENERATE_PASSWORD':
          return await this.handleGeneratePassword(message);
        
        case 'VALIDATE_CREDENTIAL':
          return await this.handleValidateCredential(message);
        
        case 'SEARCH_CREDENTIALS':
          return await this.handleSearchCredentials(message);
        
        case 'EXPORT_CREDENTIALS':
          return await this.handleExportCredentials(message);
        
        case 'IMPORT_CREDENTIALS':
          return await this.handleImportCredentials(message);
        
        case 'GET_STATISTICS':
          return await this.handleGetStatistics(message);
        
        default:
          return { success: false, error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('❌ [PASSWORD] Message handling error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle store credentials request
   * @param {Object} message - Message object from popup
   * @returns {Object} Result of the operation
   */
  async handleStoreCredentials(message) {
    try {
      const { seedPhrase, credentials } = message;
      
      if (!seedPhrase || !credentials) {
        throw new Error('Missing required parameters: seedPhrase and credentials');
      }

      const result = await passwordService.storeCredentials(seedPhrase, credentials);
      
      return {
        success: true,
        result
      };
    } catch (error) {
      console.error('❌ [PASSWORD] Error storing credentials:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle get credentials request
   * @param {Object} message - Message object from popup
   * @returns {Object} Result of the operation
   */
  async handleGetCredentials(message) {
    try {
      const { seedPhrase, options = {} } = message;
      
      if (!seedPhrase) {
        throw new Error('Missing required parameter: seedPhrase');
      }

      const result = await passwordService.getCredentials(seedPhrase, options);
      
      return {
        success: true,
        credentials: result.credentials,
        metadata: result.metadata
      };
    } catch (error) {
      console.error('❌ [PASSWORD] Error retrieving credentials:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle backup creation request
   * @param {Object} message - Message object from popup
   * @returns {Object} Result of the operation
   */
  async handleCreateBackup(message) {
    try {
      const { seedPhrase, options = {} } = message;
      
      if (!seedPhrase) {
        throw new Error('Missing required parameter: seedPhrase');
      }

      const result = await passwordService.createBackup(seedPhrase, options);
      
      return {
        success: true,
        backup: result
      };
    } catch (error) {
      console.error('❌ [PASSWORD] Error creating backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle backup list request
   * @param {Object} message - Message object from popup
   * @returns {Object} Result of the operation
   */
  async handleGetBackups(message) {
    try {
      const result = await passwordService.getBackupList();
      
      return {
        success: true,
        backups: result
      };
    } catch (error) {
      console.error('❌ [PASSWORD] Error getting backups:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle backup restore request
   * @param {Object} message - Message object from popup
   * @returns {Object} Result of the operation
   */
  async handleRestoreBackup(message) {
    try {
      const { seedPhrase, backupId } = message;
      
      if (!seedPhrase || !backupId) {
        throw new Error('Missing required parameters: seedPhrase and backupId');
      }

      const result = await passwordService.restoreFromBackup(seedPhrase, backupId);
      
      return {
        success: true,
        result
      };
    } catch (error) {
      console.error('❌ [PASSWORD] Error restoring backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle password generation request
   * @param {Object} message - Message object from popup
   * @returns {Object} Result of the operation
   */
  async handleGeneratePassword(message) {
    try {
      const { length = 12, options = {} } = message;

      const password = passwordService.generatePassword(
        length,
        options
      );
      
      return {
        success: true,
        password
      };
    } catch (error) {
      console.error('❌ [PASSWORD] Error generating password:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle credential validation request
   * @param {Object} message - Message object from popup
   * @returns {Object} Result of the operation
   */
  async handleValidateCredential(message) {
    try {
      const { credential } = message;
      
      if (!credential) {
        throw new Error('Missing required parameter: credential');
      }

      const isValid = passwordService.validateCredential(credential);
      
      return {
        success: true,
        isValid,
        errors: isValid ? [] : ['Invalid credential format']
      };
    } catch (error) {
      console.error('❌ [PASSWORD] Error validating credential:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle credential search request
   * @param {Object} message - Message object from popup
   * @returns {Object} Result of the operation
   */
  async handleSearchCredentials(message) {
    try {
      const { seedPhrase, query, options = {} } = message;
      
      if (!seedPhrase || !query) {
        throw new Error('Missing required parameters: seedPhrase and query');
      }

      const results = await passwordService.searchCredentials(seedPhrase, query, options);
      
      return {
        success: true,
        results
      };
    } catch (error) {
      console.error('❌ [PASSWORD] Error searching credentials:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle export credentials request
   * @param {Object} message - Message object from popup
   * @returns {Object} Result of the operation
   */
  async handleExportCredentials(message) {
    try {
      const { seedPhrase, format = 'json', options = {} } = message;
      
      if (!seedPhrase) {
        throw new Error('Missing required parameter: seedPhrase');
      }

      const exportData = await passwordService.exportCredentials(seedPhrase, format, options);
      
      return {
        success: true,
        data: exportData.data,
        filename: exportData.filename,
        format
      };
    } catch (error) {
      console.error('❌ [PASSWORD] Error exporting credentials:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle import credentials request
   * @param {Object} message - Message object from popup
   * @returns {Object} Result of the operation
   */
  async handleImportCredentials(message) {
    try {
      const { seedPhrase, data, format = 'json', options = {} } = message;
      
      if (!seedPhrase || !data) {
        throw new Error('Missing required parameters: seedPhrase and data');
      }

      const result = await passwordService.importCredentials(seedPhrase, data, format, options);
      
      return {
        success: true,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors
      };
    } catch (error) {
      console.error('❌ [PASSWORD] Error importing credentials:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get password management configuration
   * @returns {Object} Current password management configuration
   */
  getConfiguration() {
    return {
      maxCredentials: passwordService.getMaxCredentials(),
      encryptionEnabled: passwordService.isEncryptionEnabled(),
      backupEnabled: passwordService.isBackupEnabled(),
      debugLogging: this.isDebugEnabled
    };
  }

  /**
   * Get password management statistics
   * @param {string} seedPhrase - User's seed phrase
   * @returns {Promise<Object>} Statistics about stored credentials
   */
  async handleGetStatistics(message) {
    try {
      const { seedPhrase } = message;
      
      if (!seedPhrase) {
        throw new Error('Missing required parameter: seedPhrase');
      }

      const stats = await passwordService.getStatistics(seedPhrase);
      
      return {
        success: true,
        statistics: stats
      };
    } catch (error) {
      console.error('❌ [PASSWORD] Error getting statistics:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export singleton instance
export const passwordController = new PasswordController(); 
