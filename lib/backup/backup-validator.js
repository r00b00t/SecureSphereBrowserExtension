/**
 * Backup Validator
 * Validates backup data structure and integrity
 */

export class BackupValidator {
  constructor() {
    this.supportedVersions = ['1.0', '1.1', '1.2.0'];
    this.requiredFields = ['version', 'timestamp'];
    this.maxBackupSize = 50 * 1024 * 1024; // 50MB max backup size
  }

  /**
   * Validate backup data structure
   * @param {Object} data - Backup data to validate
   * @returns {boolean} True if valid, false otherwise
   */
  validateBackupData(data) {
    try {
      if (!data || typeof data !== 'object') {
        return false;
      }

      // Check for basic required fields
      if (!this.hasRequiredFields(data)) {
        return false;
      }

      // Validate version
      if (!this.isVersionSupported(data.version)) {
        return false;
      }

      // Validate data structure based on version
      return this.validateVersionSpecificStructure(data);
    } catch (error) {
      console.error('❌ [BackupValidator] Validation error:', error);
      return false;
    }
  }

  /**
   * Check if backup has required fields
   * @param {Object} data - Backup data
   * @returns {boolean}
   */
  hasRequiredFields(data) {
    return this.requiredFields.every(field => field in data);
  }

  /**
   * Check if version is supported
   * @param {string} version - Backup version
   * @returns {boolean}
   */
  isVersionSupported(version) {
    return this.supportedVersions.includes(version);
  }

  /**
   * Validate structure based on backup version
   * @param {Object} data - Backup data
   * @returns {boolean}
   */
  validateVersionSpecificStructure(data) {
    switch (data.version) {
      case '1.0':
        return this.validateV1Structure(data);
      case '1.1':
        return this.validateV1_1Structure(data);
      case '1.2.0':
        return this.validateV1_2Structure(data);
      default:
        return false;
    }
  }

  /**
   * Validate version 1.0 structure (legacy)
   * @param {Object} data - Backup data
   * @returns {boolean}
   */
  validateV1Structure(data) {
    // Version 1.0 only had passwords and walletSeeds arrays
    if (!Array.isArray(data.passwords) && !Array.isArray(data.walletSeeds)) {
      return false;
    }

    // Validate passwords array
    if (data.passwords && !this.validatePasswordsArray(data.passwords)) {
      return false;
    }

    // Validate walletSeeds array
    if (data.walletSeeds && !this.validateWalletSeedsArray(data.walletSeeds)) {
      return false;
    }

    return true;
  }

  /**
   * Validate version 1.1 structure
   * @param {Object} data - Backup data
   * @returns {boolean}
   */
  validateV1_1Structure(data) {
    // Version 1.1 includes legacy format + enhanced credentials
    if (!this.validateV1Structure(data)) {
      return false;
    }

    // Validate credentials array if present
    if (data.credentials && !this.validateCredentialsArray(data.credentials)) {
      return false;
    }

    return true;
  }

  /**
   * Validate version 1.2.0 structure (current)
   * @param {Object} data - Backup data
   * @returns {boolean}
   */
  validateV1_2Structure(data) {
    // Version 1.2.0 includes everything + metadata and settings
    if (!this.validateV1_1Structure(data)) {
      return false;
    }

    // Validate userId if present
    if (data.userId && typeof data.userId !== 'string') {
      return false;
    }

    // Validate settings object if present
    if (data.settings && !this.validateSettingsObject(data.settings)) {
      return false;
    }

    // Validate meta object if present
    if (data.meta && !this.validateMetaObject(data.meta)) {
      return false;
    }

    return true;
  }

  /**
   * Validate passwords array (legacy format)
   * @param {Array} passwords - Passwords array
   * @returns {boolean}
   */
  validatePasswordsArray(passwords) {
    if (!Array.isArray(passwords)) {
      return false;
    }

    return passwords.every(password => {
      return password && 
             typeof password === 'object' &&
             typeof password.website === 'string' &&
             typeof password.username === 'string' &&
             typeof password.password === 'string';
    });
  }

  /**
   * Validate wallet seeds array (legacy format)
   * @param {Array} walletSeeds - Wallet seeds array
   * @returns {boolean}
   */
  validateWalletSeedsArray(walletSeeds) {
    if (!Array.isArray(walletSeeds)) {
      return false;
    }

    return walletSeeds.every(seed => {
      return seed && 
             typeof seed === 'object' &&
             typeof seed.seedPhrase === 'string';
    });
  }

  /**
   * Validate credentials array (enhanced format)
   * @param {Array} credentials - Credentials array
   * @returns {boolean}
   */
  validateCredentialsArray(credentials) {
    if (!Array.isArray(credentials)) {
      return false;
    }

    return credentials.every(credential => {
      return credential && 
             typeof credential === 'object' &&
             this.validateCredentialObject(credential);
    });
  }

  /**
   * Validate individual credential object
   * @param {Object} credential - Credential object
   * @returns {boolean}
   */
  validateCredentialObject(credential) {
    const requiredFields = ['id', 'title'];
    const optionalFields = ['username', 'password', 'seedPhrase', 'category', 'notes', 'createdAt', 'updatedAt', 'type'];

    // Check required fields
    if (!requiredFields.every(field => field in credential && typeof credential[field] === 'string')) {
      return false;
    }

    // Check optional fields (if present, must be strings)
    for (const field of optionalFields) {
      if (credential[field] !== undefined && typeof credential[field] !== 'string') {
        return false;
      }
    }

    // Validate dates if present
    if (credential.createdAt && !this.isValidDate(credential.createdAt)) {
      return false;
    }

    if (credential.updatedAt && !this.isValidDate(credential.updatedAt)) {
      return false;
    }

    return true;
  }

  /**
   * Validate settings object
   * @param {Object} settings - Settings object
   * @returns {boolean}
   */
  validateSettingsObject(settings) {
    if (!settings || typeof settings !== 'object') {
      return false;
    }

    // Validate encryption field if present
    if (settings.encryption && typeof settings.encryption !== 'string') {
      return false;
    }

    // Validate iterations field if present
    if (settings.iterations && (typeof settings.iterations !== 'number' || settings.iterations < 1000)) {
      return false;
    }

    return true;
  }

  /**
   * Validate meta object
   * @param {Object} meta - Meta object
   * @returns {boolean}
   */
  validateMetaObject(meta) {
    if (!meta || typeof meta !== 'object') {
      return false;
    }

    // Validate source field if present
    if (meta.source && typeof meta.source !== 'string') {
      return false;
    }

    // Validate platform field if present
    if (meta.platform && typeof meta.platform !== 'string') {
      return false;
    }

    // Validate total_items field if present
    if (meta.total_items && typeof meta.total_items !== 'number') {
      return false;
    }

    // Validate backup_type field if present
    if (meta.backup_type && typeof meta.backup_type !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Check if string is a valid date
   * @param {string} dateString - Date string to validate
   * @returns {boolean}
   */
  isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  /**
   * Validate backup file size
   * @param {number} size - File size in bytes
   * @returns {boolean}
   */
  validateBackupSize(size) {
    return size > 0 && size <= this.maxBackupSize;
  }

  /**
   * Get validation errors for detailed feedback
   * @param {Object} data - Backup data to validate
   * @returns {Array} Array of validation errors
   */
  getValidationErrors(data) {
    const errors = [];

    try {
      if (!data || typeof data !== 'object') {
        errors.push('Backup data must be a valid object');
        return errors;
      }

      // Check required fields
      for (const field of this.requiredFields) {
        if (!(field in data)) {
          errors.push(`Missing required field: ${field}`);
        }
      }

      // Check version
      if (!this.isVersionSupported(data.version)) {
        errors.push(`Unsupported backup version: ${data.version}. Supported versions: ${this.supportedVersions.join(', ')}`);
      }

      // Check structure based on version
      if (data.version && this.isVersionSupported(data.version)) {
        const structureErrors = this.getStructureErrors(data);
        errors.push(...structureErrors);
      }

      return errors;
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return errors;
    }
  }

  /**
   * Get structure-specific validation errors
   * @param {Object} data - Backup data
   * @returns {Array} Array of structure errors
   */
  getStructureErrors(data) {
    const errors = [];

    // Check passwords array
    if (data.passwords && !this.validatePasswordsArray(data.passwords)) {
      errors.push('Invalid passwords array structure');
    }

    // Check walletSeeds array
    if (data.walletSeeds && !this.validateWalletSeedsArray(data.walletSeeds)) {
      errors.push('Invalid walletSeeds array structure');
    }

    // Check credentials array
    if (data.credentials && !this.validateCredentialsArray(data.credentials)) {
      errors.push('Invalid credentials array structure');
    }

    // Check settings object
    if (data.settings && !this.validateSettingsObject(data.settings)) {
      errors.push('Invalid settings object structure');
    }

    // Check meta object
    if (data.meta && !this.validateMetaObject(data.meta)) {
      errors.push('Invalid meta object structure');
    }

    return errors;
  }
} 