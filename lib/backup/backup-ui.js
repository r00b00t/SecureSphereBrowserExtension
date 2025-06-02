/**
 * Backup UI Handler
 * Manages all backup-related user interface operations
 */

export class BackupUI {
  constructor() {
    this.loadingStates = new Map();
    this.setupEventListeners();
  }

  /**
   * Initialize backup UI components
   */
  init() {
    this.setupEventListeners();
    this.loadBackupSettings();
    this.updateBackupStatus();
  }

  /**
   * Setup event listeners for backup UI elements
   */
  setupEventListeners() {
    // Create backup button
    const createBackupBtn = document.getElementById('createBackupBtn');
    if (createBackupBtn) {
      createBackupBtn.addEventListener('click', () => this.handleCreateBackup());
    }

    // Restore backup button
    const restoreBackupBtn = document.getElementById('restoreBackupBtn');
    if (restoreBackupBtn) {
      restoreBackupBtn.addEventListener('click', () => this.handleRestoreBackup());
    }

    // Export backup button
    const exportBackupBtn = document.getElementById('exportBackupBtn');
    if (exportBackupBtn) {
      exportBackupBtn.addEventListener('click', () => this.handleExportBackup());
    }

    // Import backup file input
    const importBackupInput = document.getElementById('importBackupInput');
    if (importBackupInput) {
      importBackupInput.addEventListener('change', (e) => this.handleImportBackup(e));
    }

    // Backup storage type change
    const backupStorageType = document.getElementById('backupStorageType');
    if (backupStorageType) {
      backupStorageType.addEventListener('change', () => this.handleBackupStorageChange());
    }

    // Save backup settings
    const saveBackupBtn = document.getElementById('saveBackupSettings');
    if (saveBackupBtn) {
      saveBackupBtn.addEventListener('click', () => this.saveBackupSettings());
    }

    // SIA backup management buttons
    const listSiaBackupsBtn = document.getElementById('listSiaBackupsBtn');
    if (listSiaBackupsBtn) {
      listSiaBackupsBtn.addEventListener('click', () => this.handleListSiaBackups());
    }

    const restoreSiaBackupBtn = document.getElementById('restoreSiaBackupBtn');
    if (restoreSiaBackupBtn) {
      restoreSiaBackupBtn.addEventListener('click', () => this.handleRestoreSiaBackup());
    }

    const siaBackupSelect = document.getElementById('siaBackupSelect');
    if (siaBackupSelect) {
      siaBackupSelect.addEventListener('change', () => this.handleSiaBackupSelection());
    }

    // Test SIA connection button
    const testSiaConnectionBtn = document.getElementById('testSiaConnectionBtn');
    if (testSiaConnectionBtn) {
      testSiaConnectionBtn.addEventListener('click', () => this.testSiaConnection());
    }
  }

  /**
   * Handle create backup request
   */
  async handleCreateBackup() {
    try {
      this.showButtonLoading('createBackupBtn', 'Creating backup...');

      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_BACKUP',
        seedPhrase: await this.getCurrentSeedPhrase()
      });

      if (response.success) {
        this.showSuccess('Backup created successfully! 💾');
        this.updateBackupStatus();
      } else {
        this.showError('Failed to create backup: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ [BackupUI] Create backup error:', error);
      this.showError('Failed to create backup: ' + error.message);
    } finally {
      this.hideButtonLoading('createBackupBtn', 'Create Backup');
    }
  }

  /**
   * Handle restore backup request
   */
  async handleRestoreBackup() {
    try {
      // This would typically open a file picker
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          await this.processRestoreFile(file);
        }
      };
      input.click();
    } catch (error) {
      console.error('❌ [BackupUI] Restore backup error:', error);
      this.showError('Failed to restore backup: ' + error.message);
    }
  }

  /**
   * Process restore file
   * @param {File} file - Backup file to restore
   */
  async processRestoreFile(file) {
    try {
      this.showButtonLoading('restoreBackupBtn', 'Restoring backup...');

      const response = await chrome.runtime.sendMessage({
        type: 'IMPORT_BACKUP',
        backupFile: file,
        seedPhrase: await this.getCurrentSeedPhrase()
      });

      if (response.success) {
        this.showSuccess('Backup restored successfully! ✅');
        this.updateBackupStatus();
      } else {
        this.showError('Failed to restore backup: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ [BackupUI] Process restore file error:', error);
      this.showError('Failed to restore backup: ' + error.message);
    } finally {
      this.hideButtonLoading('restoreBackupBtn', 'Restore Backup');
    }
  }

  /**
   * Handle export backup request
   */
  async handleExportBackup() {
    try {
      this.showButtonLoading('exportBackupBtn', 'Exporting backup...');

      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_BACKUP',
        seedPhrase: await this.getCurrentSeedPhrase()
      });

      if (response.success) {
        this.showSuccess('Backup exported successfully! 📁');
      } else {
        this.showError('Failed to export backup: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ [BackupUI] Export backup error:', error);
      this.showError('Failed to export backup: ' + error.message);
    } finally {
      this.hideButtonLoading('exportBackupBtn', 'Export Backup');
    }
  }

  /**
   * Handle import backup file selection
   * @param {Event} event - File input change event
   */
  async handleImportBackup(event) {
    const file = event.target.files[0];
    if (file) {
      await this.processRestoreFile(file);
    }
    // Reset file input
    event.target.value = '';
  }

  /**
   * Handle backup storage type change
   */
  handleBackupStorageChange() {
    const selectedType = document.getElementById('backupStorageType').value;
    
    // Show/hide relevant configuration sections
    this.toggleConfigurationSections(selectedType);
    
    // Show/hide SIA backup management section
    const siaBackupManagement = document.getElementById('siaBackupManagement');
    if (siaBackupManagement) {
      siaBackupManagement.style.display = selectedType === 'sia' ? 'block' : 'none';
    }
  }

  /**
   * Toggle configuration sections based on backup type
   * @param {string} backupType - Selected backup type
   */
  toggleConfigurationSections(backupType) {
    const sections = {
      'sia': 'siaConfigSection',
      's3': 's3ConfigSection',
      'securesphere': 'secureSphereConfigSection'
    };

    Object.entries(sections).forEach(([type, sectionId]) => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.style.display = type === backupType ? 'block' : 'none';
      }
    });
  }

  /**
   * Save backup settings
   */
  async saveBackupSettings() {
    try {
      const btn = document.getElementById('saveBackupSettings');
      const backupType = document.getElementById('backupStorageType').value;
      
      this.showButtonLoading('saveBackupSettings', 'Saving...');
      
      let config = { type: backupType };
      
      // Get type-specific configuration
      if (backupType === 'sia') {
        config = {
          ...config,
          ip: document.getElementById('siaIpAddress').value,
          port: document.getElementById('siaPort').value,
          password: document.getElementById('siaPassword').value
        };
      }
      
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_BACKUP_SETTINGS',
        settings: config
      });
      
      if (response.success) {
        this.showSuccess('Backup settings saved successfully! 💾');
      } else {
        this.showError('Failed to save backup settings: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ [BackupUI] Save backup settings error:', error);
      this.showError('Failed to save backup settings: ' + error.message);
    } finally {
      this.hideButtonLoading('saveBackupSettings', 'Save Settings');
    }
  }

  /**
   * Handle list SIA backups
   */
  async handleListSiaBackups() {
    try {
      const btn = document.getElementById('listSiaBackupsBtn');
      const backupList = document.getElementById('siaBackupList');
      const backupSelect = document.getElementById('siaBackupSelect');
      
      this.showButtonLoading('listSiaBackupsBtn', 'Loading backups...');
      
      const response = await chrome.runtime.sendMessage({
        type: 'LIST_SIA_BACKUPS'
      });
      
      if (response.success) {
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
          this.showSettingsStatus('siaBackupStatus', `✅ Found ${response.backups.length} backups`, 'success');
        } else {
          backupList.style.display = 'none';
          this.showSettingsStatus('siaBackupStatus', 'ℹ️ No backups found on SIA node', 'success');
        }
      } else {
        this.showSettingsStatus('siaBackupStatus', '❌ Failed to list backups: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('❌ [BackupUI] List SIA backups error:', error);
      this.showSettingsStatus('siaBackupStatus', '❌ Error listing backups: ' + error.message, 'error');
    } finally {
      this.hideButtonLoading('listSiaBackupsBtn', 'List Backups');
    }
  }

  /**
   * Handle SIA backup selection
   */
  handleSiaBackupSelection() {
    const backupSelect = document.getElementById('siaBackupSelect');
    const restoreBtn = document.getElementById('restoreSiaBackupBtn');
    
    if (restoreBtn) {
      restoreBtn.disabled = !backupSelect.value;
    }
  }

  /**
   * Handle restore SIA backup
   */
  async handleRestoreSiaBackup() {
    try {
      const backupSelect = document.getElementById('siaBackupSelect');
      const selectedPath = backupSelect.value;
      
      if (!selectedPath) {
        this.showError('Please select a backup to restore');
        return;
      }
      
      this.showButtonLoading('restoreSiaBackupBtn', 'Restoring...');
      
      const response = await chrome.runtime.sendMessage({
        type: 'RESTORE_FROM_SIA',
        backupPath: selectedPath
      });
      
      if (response.success) {
        this.showSuccess('Backup restored from SIA successfully! ✅');
        this.updateBackupStatus();
      } else {
        this.showError('Failed to restore from SIA: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ [BackupUI] Restore SIA backup error:', error);
      this.showError('Failed to restore from SIA: ' + error.message);
    } finally {
      this.hideButtonLoading('restoreSiaBackupBtn', 'Restore Selected');
    }
  }

  /**
   * Test SIA connection
   */
  async testSiaConnection() {
    try {
      this.showButtonLoading('testSiaConnectionBtn', 'Testing...');
      
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_SIA_CONNECTION'
      });
      
      if (response.success && response.connected) {
        this.showSettingsStatus('siaConnectionStatus', '✅ SIA connection successful', 'success');
      } else {
        this.showSettingsStatus('siaConnectionStatus', '❌ SIA connection failed: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('❌ [BackupUI] Test SIA connection error:', error);
      this.showSettingsStatus('siaConnectionStatus', '❌ Connection test error: ' + error.message, 'error');
    } finally {
      this.hideButtonLoading('testSiaConnectionBtn', 'Test Connection');
    }
  }

  /**
   * Load backup settings into UI
   */
  async loadBackupSettings() {
    try {
      const settings = await chrome.storage.local.get(['settings']);
      
      if (settings.settings?.backup) {
        const backupSettings = settings.settings.backup;
        
        // Set backup type
        const backupTypeSelect = document.getElementById('backupStorageType');
        if (backupTypeSelect) {
          backupTypeSelect.value = backupSettings.type || 'securesphere';
          this.handleBackupStorageChange();
        }
        
        // Load SIA settings
        if (backupSettings.type === 'sia') {
          const siaIpInput = document.getElementById('siaIpAddress');
          const siaPortInput = document.getElementById('siaPort');
          const siaPasswordInput = document.getElementById('siaPassword');
          
          if (siaIpInput) siaIpInput.value = backupSettings.ip || '';
          if (siaPortInput) siaPortInput.value = backupSettings.port || '';
          if (siaPasswordInput) siaPasswordInput.value = backupSettings.password || '';
        }
      }
    } catch (error) {
      console.error('❌ [BackupUI] Load backup settings error:', error);
    }
  }

  /**
   * Update backup status display
   */
  async updateBackupStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_BACKUP_STATS'
      });
      
      if (response.success) {
        this.displayBackupStats(response.data);
      }
    } catch (error) {
      console.error('❌ [BackupUI] Update backup status error:', error);
    }
  }

  /**
   * Display backup statistics
   * @param {Object} stats - Backup statistics
   */
  displayBackupStats(stats) {
    const statusElement = document.getElementById('backupStatus');
    if (statusElement) {
      statusElement.innerHTML = `
        <div class="backup-stats">
          <div class="stat">
            <span class="label">Total Backups:</span>
            <span class="value">${stats.totalBackups || 0}</span>
          </div>
          <div class="stat">
            <span class="label">Last Backup:</span>
            <span class="value">${stats.lastBackup ? new Date(stats.lastBackup).toLocaleDateString() : 'Never'}</span>
          </div>
        </div>
      `;
    }
  }

  /**
   * Get current user's seed phrase
   */
  async getCurrentSeedPhrase() {
    // This would be implemented based on your auth system
    // For now, return a placeholder or get from session
    try {
      const session = await chrome.storage.local.get(['currentUserSession']);
      return session.currentUserSession?.seedPhrase || '';
    } catch (error) {
      console.error('❌ [BackupUI] Get seed phrase error:', error);
      return '';
    }
  }

  /**
   * Show button loading state
   * @param {string} buttonId - Button element ID
   * @param {string} loadingText - Loading text to display
   */
  showButtonLoading(buttonId, loadingText) {
    const button = document.getElementById(buttonId);
    if (button) {
      this.loadingStates.set(buttonId, button.textContent);
      button.textContent = loadingText;
      button.disabled = true;
    }
  }

  /**
   * Hide button loading state
   * @param {string} buttonId - Button element ID
   * @param {string} originalText - Original button text (optional)
   */
  hideButtonLoading(buttonId, originalText = null) {
    const button = document.getElementById(buttonId);
    if (button) {
      const savedText = this.loadingStates.get(buttonId);
      button.textContent = originalText || savedText || 'Complete';
      button.disabled = false;
      this.loadingStates.delete(buttonId);
    }
  }

  /**
   * Show success message
   * @param {string} message - Success message
   */
  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    this.showNotification(message, 'error');
  }

  /**
   * Show notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, info)
   */
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  /**
   * Show settings status
   * @param {string} elementId - Status element ID
   * @param {string} message - Status message
   * @param {string} type - Status type (success, error, info)
   */
  showSettingsStatus(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = message;
      element.className = `settings-status status-${type}`;
    }
  }
} 