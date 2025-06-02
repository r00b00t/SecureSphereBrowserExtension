/**
 * SIA Backup Service
 * Handles all SIA decentralized storage backup operations
 */

export class SiaBackupService {
  constructor() {
    this.timeout = {
      upload: 30000,  // 30 seconds
      download: 30000, // 30 seconds
      list: 10000     // 10 seconds
    };
  }

  /**
   * Upload backup to SIA node
   * @param {Object} backupData - Backup data to upload
   * @param {string} customName - Custom backup name (optional)
   */
  async uploadToSia(backupData, customName = null) {
    try {
      // Get SIA configuration from settings
      const settings = await this.getSiaSettings();
      const { ip, port, password } = settings;
      
      // Get consistent user ID
      const userId = await this.getUserId();
      const fileName = customName || `backup_${Date.now()}.json`;
      const url = `http://${ip}:${port}/api/worker/objects/backup/${userId}/${fileName}`;
      
      // Prepare authentication header
      const authHeader = this.createAuthHeader(password);
      
      // Prepare backup data
      const jsonBody = JSON.stringify(backupData);
      
      // Upload to SIA node with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout.upload);
      
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
        throw new Error(`Upload failed: ${response.status} - ${responseText}`);
      }
      
      return { 
        success: true, 
        fileName, 
        url, 
        userId,
        uploadedAt: new Date().toISOString(),
        size: jsonBody.length
      };
    } catch (error) {
      console.error('❌ [SiaBackupService] Upload failed:', error);
      if (error.name === 'AbortError') {
        throw new Error('Upload timeout (30 seconds)');
      }
      throw new Error(`SIA upload failed: ${error.message}`);
    }
  }

  /**
   * List backups from SIA node
   */
  async listBackups() {
    try {
      // Get SIA configuration from settings
      const settings = await this.getSiaSettings();
      const { ip, port, password } = settings;
      
      // Get consistent user ID
      const userId = await this.getUserId();
      const url = `http://${ip}:${port}/api/worker/objects/backup/${userId}/`;
      
      // Prepare authentication header
      const authHeader = this.createAuthHeader(password);
      
      // Fetch backup list with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout.list);
      
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
        throw new Error(`Failed to list backups: ${response.status} - ${responseText}`);
      }
      
      const backups = await response.json();
      
      // Format backups to match expected structure
      return Array.isArray(backups) ? backups.map(item => ({
        date: item.modTime || '',
        name: item.eTag || item.name || '',
        path: item.name || '',
        size: item.size || 0,
        mimeType: item.mimeType || '',
        source: 'sia'
      })) : [];
    } catch (error) {
      console.error('❌ [SiaBackupService] List backups failed:', error);
      if (error.name === 'AbortError') {
        throw new Error('List timeout (10 seconds)');
      }
      throw new Error(`SIA list failed: ${error.message}`);
    }
  }

  /**
   * Restore backup from SIA node
   * @param {string} backupPath - Path to backup file on SIA
   */
  async restoreFromSia(backupPath) {
    try {
      // Get SIA configuration from settings
      const settings = await this.getSiaSettings();
      const { ip, port, password } = settings;
      
      // Build restore URL
      const url = `http://${ip}:${port}/api/worker/objects${backupPath}`;
      
      // Prepare authentication header
      const authHeader = this.createAuthHeader(password);
      
      // Fetch backup data with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout.download);
      
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
        throw new Error(`Failed to restore backup: ${response.status} - ${responseText}`);
      }
      
      const backupData = await response.json();
      
      if (!backupData || typeof backupData !== 'object') {
        throw new Error('Invalid backup data format');
      }
      
      return {
        ...backupData,
        restoredAt: new Date().toISOString(),
        source: 'sia'
      };
    } catch (error) {
      console.error('❌ [SiaBackupService] Restore failed:', error);
      if (error.name === 'AbortError') {
        throw new Error('Restore timeout (30 seconds)');
      }
      throw new Error(`SIA restore failed: ${error.message}`);
    }
  }

  /**
   * Delete backup from SIA node
   * @param {string} backupPath - Path to backup file on SIA
   */
  async deleteBackup(backupPath) {
    try {
      // Get SIA configuration from settings
      const settings = await this.getSiaSettings();
      const { ip, port, password } = settings;
      
      // Build delete URL
      const url = `http://${ip}:${port}/api/worker/objects${backupPath}`;
      
      // Prepare authentication header
      const authHeader = this.createAuthHeader(password);
      
      // Delete backup with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout.upload);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': authHeader,
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.status !== 200 && response.status !== 204) {
        const responseText = await response.text();
        throw new Error(`Failed to delete backup: ${response.status} - ${responseText}`);
      }
      
      return {
        success: true,
        deletedAt: new Date().toISOString(),
        path: backupPath
      };
    } catch (error) {
      console.error('❌ [SiaBackupService] Delete failed:', error);
      if (error.name === 'AbortError') {
        throw new Error('Delete timeout (30 seconds)');
      }
      throw new Error(`SIA delete failed: ${error.message}`);
    }
  }

  /**
   * Test SIA connection
   * @param {Object} config - SIA configuration to test
   */
  async testConnection(config = null) {
    try {
      const settings = config || await this.getSiaSettings();
      const { ip, port, password } = settings;
      
      // Test connection endpoint
      const url = `http://${ip}:${port}/api/worker/state`;
      
      // Prepare authentication header
      const authHeader = this.createAuthHeader(password);
      
      // Test connection with short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second test
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      return {
        success: response.status === 200,
        status: response.status,
        connected: response.status === 200
      };
    } catch (error) {
      console.error('❌ [SiaBackupService] Connection test failed:', error);
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Get SIA settings from storage
   */
  async getSiaSettings() {
    try {
      const settings = await chrome.storage.local.get(['settings']);
      
      if (!settings.settings?.backup || settings.settings.backup.type !== 'sia') {
        throw new Error('SIA backup not configured');
      }
      
      const { ip, port, password } = settings.settings.backup;
      
      if (!ip || !port || !password) {
        throw new Error('Missing SIA node configuration (IP, port, or password)');
      }
      
      return { ip, port, password };
    } catch (error) {
      console.error('❌ [SiaBackupService] Get settings failed:', error);
      throw error;
    }
  }

  /**
   * Create authentication header for SIA
   * @param {string} password - SIA node password
   */
  createAuthHeader(password) {
    const authString = ':' + password;
    return 'Basic ' + btoa(authString);
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
      console.error('❌ [SiaBackupService] Get user ID failed:', error);
      return 'user_' + Date.now();
    }
  }

  /**
   * Get backup statistics from SIA
   */
  async getBackupStats() {
    try {
      const backups = await this.listBackups();
      
      const totalSize = backups.reduce((sum, backup) => sum + (backup.size || 0), 0);
      const latestBackup = backups.length > 0 ? 
        backups.reduce((latest, backup) => 
          backup.date > latest.date ? backup : latest
        ) : null;
      
      return {
        totalBackups: backups.length,
        totalSize: totalSize,
        averageSize: backups.length > 0 ? Math.round(totalSize / backups.length) : 0,
        latestBackup: latestBackup?.date || null,
        backups: backups
      };
    } catch (error) {
      console.error('❌ [SiaBackupService] Get backup stats failed:', error);
      return {
        totalBackups: 0,
        totalSize: 0,
        averageSize: 0,
        latestBackup: null,
        backups: []
      };
    }
  }
} 