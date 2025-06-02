/**
 * Backup Controller
 * Centralizes all backup operations and message handling
 */

import { BackupService } from './backup-service.js';
import { SiaBackupService } from './sia-backup-service.js';
import { BackupValidator } from './backup-validator.js';

export class BackupController {
  constructor() {
    this.backupService = new BackupService();
    this.siaBackupService = new SiaBackupService();
    this.validator = new BackupValidator();
  }

  /**
   * Handle backup-related messages
   * @param {Object} message - The message object
   * @param {Function} sendResponse - Response callback
   */
  async handleMessage(message, sendResponse) {
    try {
      switch (message.type) {
        case 'CREATE_BACKUP':
          return await this.handleCreateBackup(message);

        case 'RESTORE_BACKUP':
          return await this.handleRestoreBackup(message);

        case 'EXPORT_BACKUP':
          return await this.handleExportBackup(message);

        case 'IMPORT_BACKUP':
          return await this.handleImportBackup(message);

        case 'UPLOAD_TO_SIA':
          return await this.handleUploadToSia(message);

        case 'LIST_SIA_BACKUPS':
          return await this.handleListSiaBackups(message);

        case 'RESTORE_FROM_SIA':
          return await this.handleRestoreFromSia(message);

        case 'SAVE_BACKUP_SETTINGS':
          return await this.handleSaveBackupSettings(message);

        default:
          throw new Error(`Unknown backup message type: ${message.type}`);
      }
    } catch (error) {
      console.error('❌ [BackupController] Error handling message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle create backup request
   */
  async handleCreateBackup(message) {
    try {
      const { seedPhrase, options = {} } = message;
      
      if (!seedPhrase) {
        throw new Error('Seed phrase is required for backup creation');
      }

      const backupData = await this.backupService.createBackup(seedPhrase, options);
      
      return {
        success: true,
        data: backupData,
        message: 'Backup created successfully'
      };
    } catch (error) {
      console.error('❌ [BackupController] Create backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle restore backup request
   */
  async handleRestoreBackup(message) {
    try {
      const { backupData, seedPhrase } = message;
      
      if (!this.validator.validateBackupData(backupData)) {
        throw new Error('Invalid backup data format');
      }

      const result = await this.backupService.restoreBackup(backupData, seedPhrase);
      
      return {
        success: true,
        data: result,
        message: 'Backup restored successfully'
      };
    } catch (error) {
      console.error('❌ [BackupController] Restore backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle export backup request
   */
  async handleExportBackup(message) {
    try {
      const { seedPhrase } = message;
      const backupBlob = await this.backupService.exportBackup(seedPhrase);
      
      return {
        success: true,
        data: backupBlob,
        message: 'Backup exported successfully'
      };
    } catch (error) {
      console.error('❌ [BackupController] Export backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle import backup request
   */
  async handleImportBackup(message) {
    try {
      const { backupFile, seedPhrase } = message;
      const result = await this.backupService.importBackup(backupFile, seedPhrase);
      
      return {
        success: true,
        data: result,
        message: 'Backup imported successfully'
      };
    } catch (error) {
      console.error('❌ [BackupController] Import backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle SIA upload request
   */
  async handleUploadToSia(message) {
    try {
      const { backupData, customName } = message;
      const result = await this.siaBackupService.uploadToSia(backupData, customName);
      
      return {
        success: true,
        data: result,
        message: 'Backup uploaded to SIA successfully'
      };
    } catch (error) {
      console.error('❌ [BackupController] SIA upload failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle SIA backup list request
   */
  async handleListSiaBackups(message) {
    try {
      const backups = await this.siaBackupService.listBackups();
      
      return {
        success: true,
        backups: backups,
        message: 'SIA backups listed successfully'
      };
    } catch (error) {
      console.error('❌ [BackupController] List SIA backups failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle SIA restore request
   */
  async handleRestoreFromSia(message) {
    try {
      const { backupPath } = message;
      const backupData = await this.siaBackupService.restoreFromSia(backupPath);
      
      if (!this.validator.validateBackupData(backupData)) {
        throw new Error('Invalid backup data retrieved from SIA');
      }

      return {
        success: true,
        data: backupData,
        message: 'Backup restored from SIA successfully'
      };
    } catch (error) {
      console.error('❌ [BackupController] SIA restore failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle save backup settings request
   */
  async handleSaveBackupSettings(message) {
    try {
      const { settings } = message;
      const result = await this.backupService.saveBackupSettings(settings);
      
      return {
        success: true,
        data: result,
        message: 'Backup settings saved successfully'
      };
    } catch (error) {
      console.error('❌ [BackupController] Save backup settings failed:', error);
      return { success: false, error: error.message };
    }
  }
} 