// Authentication Settings UI Module
export class AuthSettingsPanel {
  constructor() {
    this.isOpen = false;
    this.panel = null;
  }

  // Create and show the auth settings panel
  async show() {
    if (this.isOpen) return;
    
    this.isOpen = true;
    this.panel = this.createPanel();
    document.body.appendChild(this.panel);
    
    await this.loadAuthStatus();
    this.setupEventListeners();
  }

  // Create the settings panel DOM
  createPanel() {
    const panel = document.createElement('div');
    panel.id = 'authSettingsPanel';
    panel.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
    `;

    panel.innerHTML = `
      <div style="
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #333;">Account & Backup Settings</h2>
          <button id="closeAuthSettings" style="
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
          ">&times;</button>
        </div>

        <div id="authStatusSection" style="margin-bottom: 24px;">
          <h3 style="margin-bottom: 12px; color: #333;">Local Account Status</h3>
          <div id="authStatusDisplay" style="
            padding: 12px;
            border-radius: 4px;
            background: #f5f5f5;
            margin-bottom: 12px;
          ">
            <div>Loading account information...</div>
          </div>
        </div>

        <div id="apiRegistrationSection" style="margin-bottom: 24px;">
          <h3 style="margin-bottom: 12px; color: #333;">Cloud Backup & Sync</h3>
          <div id="registrationStatus" style="margin-bottom: 12px;"></div>
          <div id="registrationActions"></div>
        </div>

        <div id="accountActionsSection">
          <h3 style="margin-bottom: 12px; color: #333;">Actions</h3>
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button id="refreshStatusBtn" style="
              padding: 8px 16px;
              background: #007cba;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            ">Refresh Status</button>
            <button id="testConnectionBtn" style="
              padding: 8px 16px;
              background: #28a745;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            ">Test Connection</button>
            <button id="clearSessionBtn" style="
              padding: 8px 16px;
              background: #dc3545;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            ">Clear Session</button>
          </div>
        </div>

        <div id="debugSection" style="margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
          <h4 style="margin-bottom: 8px; color: #666;">Debug Information</h4>
          <textarea id="debugInfo" readonly style="
            width: 100%;
            height: 100px;
            font-family: monospace;
            font-size: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 8px;
            background: #f8f9fa;
            resize: vertical;
          "></textarea>
        </div>
      </div>
    `;

    return panel;
  }

  // Load and display current authentication status
  async loadAuthStatus() {
    try {
      const statusDisplay = document.getElementById('authStatusDisplay');
      const registrationStatus = document.getElementById('registrationStatus');
      const registrationActions = document.getElementById('registrationActions');
      const debugInfo = document.getElementById('debugInfo');

      statusDisplay.innerHTML = '<div>Loading...</div>';

      // Get session info from background
      const sessionResponse = await chrome.runtime.sendMessage({ type: 'GET_SESSION_INFO' });
      const registrationResponse = await chrome.runtime.sendMessage({ type: 'CHECK_REGISTRATION_STATUS' });

      const sessionInfo = sessionResponse?.sessionInfo || {};
      const isRegistered = registrationResponse?.registered || false;

      // Display local account status
      const statusHtml = `
        <div style="margin-bottom: 8px;">
          <strong>Wallet Status:</strong> ${sessionInfo.uuid ? '✅ Active' : '❌ No Active Session'}
        </div>
        ${sessionInfo.uuid ? `<div style="margin-bottom: 8px;"><strong>Account ID:</strong> ${sessionInfo.uuid}</div>` : ''}
        ${sessionInfo.publicKey ? `<div style="margin-bottom: 8px;"><strong>Public Key:</strong> ${sessionInfo.publicKey.substring(0, 20)}...</div>` : ''}
      `;

      statusDisplay.innerHTML = statusHtml;

      // Update registration section
      if (isRegistered) {
        registrationStatus.innerHTML = `
          <div style="color: #28a745; margin-bottom: 8px;">✅ Cloud backup is enabled</div>
          <div style="font-size: 14px; color: #666;">Your passwords are backed up to secure servers and can be synced across devices</div>
        `;
        registrationActions.innerHTML = `
          <button id="syncNowBtn" style="
            padding: 8px 16px;
            background: #007cba;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 8px;
          ">Sync Now</button>
          <button id="disableBackupBtn" style="
            padding: 8px 16px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">Disable Backup</button>
        `;
      } else {
        registrationStatus.innerHTML = `
          <div style="color: #ffc107; margin-bottom: 8px;">⚠️ Cloud backup is disabled</div>
          <div style="font-size: 14px; color: #666;">Enable cloud backup to sync your passwords across devices and prevent data loss</div>
        `;
        registrationActions.innerHTML = `
          <button id="enableBackupBtn" style="
            padding: 8px 16px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">Enable Cloud Backup</button>
        `;
      }

      // Update debug info
      debugInfo.value = JSON.stringify({
        sessionInfo,
        registrationResponse,
        timestamp: new Date().toISOString()
      }, null, 2);

    } catch (error) {
      console.error('Error loading auth status:', error);
      document.getElementById('authStatusDisplay').innerHTML = `<div style="color: #dc3545;">Error: ${error.message}</div>`;
    }
  }

  // Setup event listeners for the panel
  setupEventListeners() {
    // Close panel
    document.getElementById('closeAuthSettings').addEventListener('click', () => {
      this.close();
    });

    // Refresh status
    document.getElementById('refreshStatusBtn').addEventListener('click', () => {
      this.loadAuthStatus();
    });

    // Test connection
    document.getElementById('testConnectionBtn').addEventListener('click', async () => {
      await this.testConnection();
    });

    // Clear session
    document.getElementById('clearSessionBtn').addEventListener('click', async () => {
      await this.clearSession();
    });

    // Enable backup (if button exists)
    const enableBackupBtn = document.getElementById('enableBackupBtn');
    if (enableBackupBtn) {
      enableBackupBtn.addEventListener('click', async () => {
        await this.enableCloudBackup();
      });
    }

    // Sync now (if button exists)
    const syncNowBtn = document.getElementById('syncNowBtn');
    if (syncNowBtn) {
      syncNowBtn.addEventListener('click', async () => {
        await this.syncNow();
      });
    }

    // Disable backup (if button exists)
    const disableBackupBtn = document.getElementById('disableBackupBtn');
    if (disableBackupBtn) {
      disableBackupBtn.addEventListener('click', async () => {
        await this.disableCloudBackup();
      });
    }

    // Close on background click
    this.panel.addEventListener('click', (e) => {
      if (e.target === this.panel) {
        this.close();
      }
    });
  }

  // Test API connection
  async testConnection() {
    const button = document.getElementById('testConnectionBtn');
    const originalText = button.textContent;
    
    try {
      button.textContent = 'Testing...';
      button.disabled = true;

      // Connection test - configure your API endpoint in environment variables
      // This is a placeholder implementation
      
      alert('⚠️ Connection test requires API configuration. Please check the documentation for setup instructions.');

    } catch (error) {
      alert(`❌ Connection failed: ${error.message}`);
    } finally {
      button.textContent = originalText;
      button.disabled = false;
    }
  }

  // Enable cloud backup
  async enableCloudBackup() {
    if (!confirm('Enable cloud backup? This will create a secure backup account linked to your wallet.')) {
      return;
    }

    try {
      // Get current seed phrase from storage
      const { seedPhrase } = await chrome.storage.local.get(['seedPhrase']);
      
      if (!seedPhrase) {
        alert('No wallet found. Please ensure you are logged in.');
        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: 'REGISTER_USER',
        seedPhrase: seedPhrase
      });

      if (response.success) {
        alert(`✅ Cloud backup enabled!\n\nAccount ID: ${response.uuid}\nPublic Key: ${response.publicKey.substring(0, 16)}...`);
        await this.loadAuthStatus();
      } else {
        throw new Error(response.error || 'Failed to enable backup');
      }
    } catch (error) {
      alert(`❌ Failed to enable backup: ${error.message}`);
    }
  }

  // Sync now
  async syncNow() {
    try {
      const button = document.getElementById('syncNowBtn');
      const originalText = button.textContent;
      button.textContent = 'Syncing...';
      button.disabled = true;

      // Trigger a sync by verifying with API
      const { seedPhrase } = await chrome.storage.local.get(['seedPhrase']);
      
      if (!seedPhrase) {
        throw new Error('No wallet found');
      }

      const response = await chrome.runtime.sendMessage({
        type: 'VERIFY_USER',
        seedPhrase: seedPhrase
      });

      if (response.success) {
        alert('✅ Sync completed successfully!');
      } else {
        throw new Error(response.error || 'Sync failed');
      }

      button.textContent = originalText;
      button.disabled = false;
    } catch (error) {
      alert(`❌ Sync failed: ${error.message}`);
      const button = document.getElementById('syncNowBtn');
      if (button) {
        button.textContent = 'Sync Now';
        button.disabled = false;
      }
    }
  }

  // Disable cloud backup
  async disableCloudBackup() {
    if (!confirm('Disable cloud backup? Your local data will remain, but cloud sync will be turned off.')) {
      return;
    }

    try {
      // Clear local registration data
      await chrome.storage.local.remove(['userUUID', 'publicKey', 'isRegistered']);
      
      alert('✅ Cloud backup disabled. Your local passwords remain secure.');
      await this.loadAuthStatus();
    } catch (error) {
      alert(`❌ Failed to disable backup: ${error.message}`);
    }
  }

  // Clear session
  async clearSession() {
    if (!confirm('Clear current session? You will need to login again.')) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({ type: 'LOGOUT' });
      alert('✅ Session cleared successfully.');
      await this.loadAuthStatus();
      
      // Optionally redirect to login
      window.location.reload();
    } catch (error) {
      alert(`❌ Failed to clear session: ${error.message}`);
    }
  }

  // Close the panel
  close() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    this.isOpen = false;
  }
}

// Export singleton instance
export const authSettings = new AuthSettingsPanel(); 
