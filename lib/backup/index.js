/**
 * Backup Module - Main Entry Point
 * Consolidated backup functionality for SecureSphere Extension
 */

// Import all backup components
import { BackupController } from './backup-controller.js';
import { BackupService } from './backup-service.js';
import { SiaBackupService } from './sia-backup-service.js';
import { BackupValidator } from './backup-validator.js';
import { BackupUI } from './backup-ui.js';

// Legacy compatibility exports
export {
  BackupController,
  BackupService,
  SiaBackupService,
  BackupValidator,
  BackupUI
};

// Create global backup controller instance
export const backupController = new BackupController();

// Legacy function compatibility for existing code
export const createBackup = async (seedPhrase, options = {}) => {
  const service = new BackupService();
  return await service.createBackup(seedPhrase, options);
};

export const restoreBackup = async (backupData, seedPhrase) => {
  const service = new BackupService();
  return await service.restoreBackup(backupData, seedPhrase);
};

export const exportBackup = async (seedPhrase) => {
  const service = new BackupService();
  return await service.exportBackup(seedPhrase);
};

export const importBackup = async (backupFile, seedPhrase) => {
  const service = new BackupService();
  return await service.importBackup(backupFile, seedPhrase);
};

export const validateBackupData = (data) => {
  const validator = new BackupValidator();
  return validator.validateBackupData(data);
};

// SIA backup functions
export const uploadToSiaNode = async (backupData, customName = null) => {
  const siaService = new SiaBackupService();
  return await siaService.uploadToSia(backupData, customName);
};

export const listSiaBackups = async () => {
  const siaService = new SiaBackupService();
  return await siaService.listBackups();
};

export const restoreFromSiaNode = async (backupPath) => {
  const siaService = new SiaBackupService();
  return await siaService.restoreFromSia(backupPath);
};

// Backup data creation function (for background.js compatibility)
export const createBackupData = async () => {
  try {
    // Get current user session
    const storage = await chrome.storage.local.get(['currentUserSession']);
    const currentUserSession = storage.currentUserSession;
    
    if (!currentUserSession || !currentUserSession.seedPhrase) {
      throw new Error('No active user session');
    }
    
    const service = new BackupService();
    return await service.createBackup(currentUserSession.seedPhrase);
  } catch (error) {
    console.error('❌ [BackupModule] Create backup data failed:', error);
    throw error;
  }
};

// Initialize backup UI (call this from popup.js)
export const initBackupUI = () => {
  const backupUI = new BackupUI();
  backupUI.init();
  return backupUI;
};

// Backup statistics
export const getBackupStats = async () => {
  const service = new BackupService();
  return await service.getBackupStats();
};

// Default export for convenience
export default {
  BackupController,
  BackupService,
  SiaBackupService,
  BackupValidator,
  BackupUI,
  backupController,
  
  // Legacy functions
  createBackup,
  restoreBackup,
  exportBackup,
  importBackup,
  validateBackupData,
  uploadToSiaNode,
  listSiaBackups,
  restoreFromSiaNode,
  createBackupData,
  
  // Utility functions
  initBackupUI,
  getBackupStats
};
