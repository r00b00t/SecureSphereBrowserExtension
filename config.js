// Application configuration
module.exports = {
  // Backup configuration
  backupConfig: {
    // Maximum number of backups to keep
    maxBackups: 10
  },
  
  // Security settings
  security: {
    // Minimum PIN length
    minPinLength: 4,
    
    // PIN timeout in minutes (auto-logout)
    pinTimeoutMinutes: 15
  }
};
