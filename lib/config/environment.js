// Environment Configuration Manager
// Loads configuration from environment and provides secure access to settings

import { envLoader } from './env-loader.js';

class EnvironmentConfig {
  constructor() {
    this.config = {};
    this.isInitialized = false;
  }

  /**
   * Initialize the environment configuration
   * This should be called once at startup
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      this.config = await envLoader.loadConfiguration();
      this.isInitialized = true;
      
    } catch (error) {
      console.error('❌ Failed to initialize environment configuration:', error);
      // Use defaults if initialization fails
      this.config = envLoader.getDefaultConfig();
      this.isInitialized = true;
    }
  }

  /**
   * Ensure configuration is initialized
   * @returns {Promise<void>}
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Get configuration value by key
   * @param {string} key - Configuration key
   * @returns {any} Configuration value
   */
  get(key) {
    if (!this.isInitialized) {
      
      return envLoader.getDefaultConfig()[key];
    }
    return this.config[key];
  }

  /**
   * Set configuration value
   * @param {string} key - Configuration key
   * @param {any} value - Configuration value
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value) {
    await this.ensureInitialized();
    const success = await envLoader.set(key, value);
    if (success) {
      this.config[key] = value;
    }
    return success;
  }

  /**
   * Get all configuration values
   * @returns {Object} All configuration values
   */
  getAll() {
    if (!this.isInitialized) {
      return envLoader.getDefaultConfig();
    }
    return { ...this.config };
  }

  /**
   * Check if feature is enabled
   * @param {string} feature - Feature name (e.g., 'BREACH_MONITORING')
   * @returns {boolean} Whether feature is enabled
   */
  isFeatureEnabled(feature) {
    const key = `ENABLE_${feature.toUpperCase()}`;
    return this.get(key) === true;
  }

  /**
   * Get API base URL with development override support
   * @param {string} service - Service name ('BREACH' or 'SECURESPHERE')
   * @returns {string} API base URL
   */
  getApiBaseUrl(service) {
    const isDevelopment = this.get('DEVELOPMENT_MODE');
    const devKey = `DEV_${service.toUpperCase()}_API_BASE_URL`;
    const prodKey = `${service.toUpperCase()}_API_BASE_URL`;
    
    const devUrl = this.get(devKey);
    const prodUrl = this.get(prodKey);
    
    if (isDevelopment && devUrl) {
      return devUrl;
    }
    
    return prodUrl;
  }

  /**
   * Check if in development mode
   * @returns {boolean} Whether in development mode
   */
  isDevelopment() {
    return this.get('DEVELOPMENT_MODE') === true;
  }

  /**
   * Check if debug logging is enabled
   * @returns {boolean} Whether debug logging is enabled
   */
  isDebugEnabled() {
    return this.get('ENABLE_DEBUG_LOGS') === true || this.get('VERBOSE_LOGGING') === true;
  }

  /**
   * Reset configuration to defaults
   * @returns {Promise<boolean>} Success status
   */
  async resetToDefaults() {
    const success = await envLoader.resetToDefaults();
    if (success) {
      this.config = envLoader.getDefaultConfig();
    }
    return success;
  }
}

// Create and export singleton instance
export const ENV = new EnvironmentConfig();

// Auto-initialize when module is loaded
ENV.initialize().catch(error => {
  console.error('Failed to auto-initialize environment configuration:', error);
});

// Export specific configuration getters for convenience
export const getBreachApiConfig = () => {
  const config = ENV.getAll();
  return {
    baseUrl: ENV.getApiBaseUrl('BREACH'),
    apiKey: config.BREACH_API_KEY,
    userAgent: config.BREACH_API_USER_AGENT,
    timeout: config.BREACH_CHECK_TIMEOUT,
    recentBreachesTimeout: config.RECENT_BREACHES_TIMEOUT,
    delayBetweenRequests: config.BREACH_CHECK_DELAY,
    maxConcurrentChecks: config.MAX_CONCURRENT_BREACH_CHECKS
  };
};

export const getSecureSphereApiConfig = () => {
  const config = ENV.getAll();
  return {
    baseUrl: ENV.getApiBaseUrl('SECURESPHERE'),
    apiKey: config.SECURESPHERE_API_KEY,
    apiSecret: config.SECURESPHERE_API_SECRET,
    timeout: config.SECURESPHERE_API_TIMEOUT
  };
};

export const getUIConfig = () => {
  const config = ENV.getAll();
  return {
    successMessageDuration: config.SUCCESS_MESSAGE_DURATION,
    errorMessageDuration: config.ERROR_MESSAGE_DURATION,
    warningMessageDuration: config.WARNING_MESSAGE_DURATION
  };
};

export const getSessionConfig = () => {
  const config = ENV.getAll();
  return {
    defaultTimeout: config.DEFAULT_SESSION_TIMEOUT,
    maxTimeout: config.MAX_SESSION_TIMEOUT,
    enableAutoLogout: config.ENABLE_AUTO_LOGOUT,
    enableSessionTimeout: config.ENABLE_SESSION_TIMEOUT
  };
};

export const getSecurityConfig = () => {
  const config = ENV.getAll();
  return {
    encryptionIterations: config.ENCRYPTION_ITERATIONS,
    storageKeyLength: config.STORAGE_KEY_LENGTH
  };
}; 
