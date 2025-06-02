// UI logic for the settings modal (export, import, reset, cloud backup)

export function setupSettingsModal() {
  const elements = {
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    exportDataBtn: document.getElementById('exportDataBtn'),
    importDataBtn: document.getElementById('importDataBtn'),
    importFileInput: document.getElementById('importFileInput'),
    resetDataBtn: document.getElementById('resetDataBtn'),
    cloudBackupBtn: document.getElementById('cloudBackupBtn')
  };
  
  // Validate required elements
  if (!Object.values(elements).every(Boolean)) return;
  
  // Modal controls
  elements.settingsBtn.addEventListener('click', () => {
    elements.settingsModal.style.display = 'block';
  });
  
  elements.closeSettingsBtn.addEventListener('click', () => {
    elements.settingsModal.style.display = 'none';
  });
  
  window.addEventListener('click', (event) => {
    if (event.target === elements.settingsModal) {
      elements.settingsModal.style.display = 'none';
    }
  });
  
  // Export data
  elements.exportDataBtn.addEventListener('click', async () => {
    try {
      // TODO: Need access to chrome.storage.local - consider passing it or using messaging
      const { passwords, walletSeeds } = await chrome.storage.local.get(['passwords', 'walletSeeds']) || {};
      const backupData = {
        passwords: passwords || [],
        walletSeeds: walletSeeds || [],
        timestamp: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `securesphere-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      alert('Backup exported successfully!');
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export backup. Please try again.');
    }
  });
  
  // Import data
  elements.importDataBtn.addEventListener('click', () => {
    elements.importFileInput.click();
  });
  
  elements.importFileInput.addEventListener('change', async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target.result);
          
          if (!backupData.passwords && !backupData.walletSeeds) {
            throw new Error('Invalid backup file format');
          }
          
          // TODO: Need access to chrome.storage.local and display functions
          await chrome.storage.local.set({
            passwords: backupData.passwords || [],
            walletSeeds: backupData.walletSeeds || []
          });
          
          // TODO: Need to call displayPasswords() and displayWalletSeeds() from credentials UI module
          // await Promise.all([displayPasswords(), displayWalletSeeds()]);
          
          alert('Backup imported successfully!');
          elements.settingsModal.style.display = 'none';
        } catch (error) {
          console.error('Error parsing backup file:', error);
          alert('Invalid backup file. Please try again.');
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error importing data:', error);
      alert('Failed to import backup. Please try again.');
    }
    event.target.value = '';
  });
  
  // Cloud Backup (S5)
  if (elements.cloudBackupBtn) {
    elements.cloudBackupBtn.addEventListener('click', async () => {
      try {
        
        
        // Get data to backup
        // TODO: Need access to chrome.storage.local
        const { passwords, walletSeeds } = await chrome.storage.local.get(['passwords', 'walletSeeds']) || {};
        const backupData = {
          passwords: passwords || [],
          walletSeeds: walletSeeds || [],
          timestamp: new Date().toISOString()
        };
        
        // Create file blob
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const file = new File([blob], `securesphere-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
        
        
        
        // Create FormData
        const formData = new FormData();
        formData.append('file', file);
        
        // Cloud backup configuration should be set up in environment or settings
        // This is a placeholder implementation - configure your backup service
        
        alert('Cloud backup feature requires configuration. Please check the documentation for setup instructions.');
        
      } catch (error) {
        console.error('Cloud backup error:', error);
        alert(`Cloud backup failed: ${error.message}`);
      }
    });
  }
  
  // Reset data
  elements.resetDataBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
      try {
        // TODO: Need access to chrome.storage.local and display functions
        await chrome.storage.local.set({ passwords: [], walletSeeds: [] });
        // await Promise.all([displayPasswords(), displayWalletSeeds()]);
        alert('All data has been reset successfully!');
        elements.settingsModal.style.display = 'none';
      } catch (error) {
        console.error('Error resetting data:', error);
        alert('Failed to reset data. Please try again.');
      }
    }
  });
}
