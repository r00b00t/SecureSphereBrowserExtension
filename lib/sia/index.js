// S5 cloud backup module

// Import configuration
import config from '../../config.js';

// S5 API configuration
const S5_UPLOAD_URL = config.s5.uploadUrl;
const S5_DOWNLOAD_URL = config.s5.downloadUrl;
const S5_AUTH_TOKEN = `Bearer ${config.s5.authToken}`;

// Cloud backup function
const cloudBackup = async () => {
  try {
    
    
    // Get data to backup
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
    
    
    
    // Upload to S5
    const response = await fetch(S5_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Authorization': S5_AUTH_TOKEN
      },
      body: formData
    });
    
    
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('S5 upload failed:', errorText);
      throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    
    return result;
  } catch (error) {
    console.error('Cloud backup error:', error);
    throw error;
  }
};

// Cloud restore function
const cloudRestore = async (filename) => {
  try {
    
    
    // Fetch backup from S5
    const response = await fetch(`${S5_DOWNLOAD_URL}/${filename}`);
    
    
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('S5 download failed:', errorText);
      throw new Error(`Download failed with status ${response.status}: ${errorText}`);
    }
    
    const backupData = await response.json();
    
    
    // Validate backup data
    if (!backupData || !backupData.passwords || !backupData.walletSeeds) {
      throw new Error('Invalid backup data format');
    }
    
    // Restore data to storage
    await chrome.storage.local.set({
      passwords: backupData.passwords,
      walletSeeds: backupData.walletSeeds
    });
    
    
    return backupData;
  } catch (error) {
    console.error('Cloud restore error:', error);
    throw error;
  }
};

export {
  cloudBackup,
  cloudRestore
};
