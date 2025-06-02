// Environment Configuration Loader
// Loads configuration from Chrome storage and .env file simulation

export class EnvironmentLoader {
  constructor() {
    this.config = {};
    this.defaults = this.getDefaultConfig();
  }

  /**
   * Get default configuration values
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    return {
      // API Endpoints
      BREACH_API_BASE_URL: 'https://api.example.com/v1',
      BREACH_API_KEY: '',
      BREACH_API_USER_AGENT: 'SecureSphere-Extension/1.0.0',
      
      SECURESPHERE_API_BASE_URL: 'https://api.example.com',
      SECURESPHERE_API_KEY: '',
      SECURESPHERE_API_SECRET: '',
      
      // Feature Flags
      ENABLE_BREACH_MONITORING: true,
      ENABLE_CLOUD_SYNC: true,
      ENABLE_SIA_BACKUP: true,
      ENABLE_DEBUG_LOGS: false,
      
      // Timeouts (in milliseconds)
      BREACH_CHECK_TIMEOUT: 15000,
      RECENT_BREACHES_TIMEOUT: 10000,
      SECURESPHERE_API_TIMEOUT: 30000,
      
      // Rate Limiting
      BREACH_CHECK_DELAY: 1000,
      MAX_CONCURRENT_BREACH_CHECKS: 3,
      
      // UI Configuration
      SUCCESS_MESSAGE_DURATION: 4000,
      ERROR_MESSAGE_DURATION: 6000,
      WARNING_MESSAGE_DURATION: 5000,
      
      // Session Settings
      DEFAULT_SESSION_TIMEOUT: 30,
      MAX_SESSION_TIMEOUT: 240,
      
      // Security Settings
      ENCRYPTION_ITERATIONS: 100000,
      STORAGE_KEY_LENGTH: 256,
      ENABLE_AUTO_LOGOUT: true,
      ENABLE_SESSION_TIMEOUT: true,
      
      // Development Settings
      DEVELOPMENT_MODE: false,
      MOCK_API_RESPONSES: false,
      VERBOSE_LOGGING: false,
      
      // Development Overrides
      DEV_BREACH_API_BASE_URL: '',
      DEV_SECURESPHERE_API_BASE_URL: ''
    };
  }

  /**
   * Load configuration from Chrome storage
   * @returns {Promise<Object>} Loaded configuration
   */
  async loadFromStorage() {
    try {
      return new Promise((resolve) => {
        chrome.storage.local.get(['envConfig'], (result) => {
          if (chrome.runtime.lastError) {
            
            resolve({});
          } else {
            resolve(result.envConfig || {});
          }
        });
      });
    } catch (error) {
      
      return {};
    }
  }

  /**
   * Save configuration to Chrome storage
   * @param {Object} config - Configuration to save
   * @returns {Promise<boolean>} Success status
   */
  async saveToStorage(config) {
    try {
      return new Promise((resolve) => {
        chrome.storage.local.set({ envConfig: config }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to save env config to storage:', chrome.runtime.lastError);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Failed to save env config to storage:', error);
      return false;
    }
  }

  /**
   * Load configuration from simulated .env values
   * In a real environment, this would parse actual .env file content
   * @returns {Object} Environment configuration
   */
  loadFromEnv() {
    // In a real browser extension, you might load this from manifest.json
    // or a pre-built configuration file. For now, we'll return empty object
    // to rely on defaults
    return {};
  }

  /**
   * Merge configuration from multiple sources
   * Priority: env config > storage config > defaults
   * @returns {Promise<Object>} Merged configuration
   */
  async loadConfiguration() {
    try {
      const storageConfig = await this.loadFromStorage();
      const envConfig = this.loadFromEnv();
      
      // Merge configurations with priority
      this.config = {
        ...this.defaults,
        ...storageConfig,
        ...envConfig
      };
      
      // Apply development mode overrides
      if (this.config.DEVELOPMENT_MODE) {
        this.applyDevelopmentOverrides();
      }
      
      return this.config;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      // Fall back to defaults
      this.config = { ...this.defaults };
      return this.config;
    }
  }

  /**
   * Apply development mode configuration overrides
   */
  applyDevelopmentOverrides() {
    // Use development URLs if specified
    if (this.config.DEV_BREACH_API_BASE_URL) {
      this.config.BREACH_API_BASE_URL = this.config.DEV_BREACH_API_BASE_URL;
    }
    
    if (this.config.DEV_SECURESPHERE_API_BASE_URL) {
      this.config.SECURESPHERE_API_BASE_URL = this.config.DEV_SECURESPHERE_API_BASE_URL;
    }
    
    // Enable debug logging in development
    if (this.config.DEVELOPMENT_MODE) {
      this.config.ENABLE_DEBUG_LOGS = true;
      this.config.VERBOSE_LOGGING = true;
    }
    
    // Increase timeouts in development for debugging
    if (this.config.DEVELOPMENT_MODE) {
      this.config.BREACH_CHECK_TIMEOUT *= 2;
      this.config.RECENT_BREACHES_TIMEOUT *= 2;
      this.config.SECURESPHERE_API_TIMEOUT *= 2;
    }
  }

  /**
   * Get a specific configuration value
   * @param {string} key - Configuration key
   * @returns {any} Configuration value
   */
  get(key) {
    return this.config[key];
  }

  /**
   * Set a configuration value
   * @param {string} key - Configuration key
   * @param {any} value - Configuration value
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value) {
    this.config[key] = value;
    return await this.saveToStorage(this.config);
  }

  /**
   * Get all configuration values
   * @returns {Object} All configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Reset configuration to defaults
   * @returns {Promise<boolean>} Success status
   */
  async resetToDefaults() {
    this.config = { ...this.defaults };
    return await this.saveToStorage(this.config);
  }

  /**
   * Check if a feature is enabled
   * @param {string} feature - Feature name
   * @returns {boolean} Whether feature is enabled
   */
  isFeatureEnabled(feature) {
    const key = `ENABLE_${feature.toUpperCase()}`;
    return this.get(key) === true;
  }

  /**
   * Enable or disable a feature
   * @param {string} feature - Feature name
   * @param {boolean} enabled - Whether to enable the feature
   * @returns {Promise<boolean>} Success status
   */
  async setFeatureEnabled(feature, enabled) {
    const key = `ENABLE_${feature.toUpperCase()}`;
    return await this.set(key, enabled);
  }

  /**
   * Get API configuration for a service
   * @param {string} service - Service name ('BREACH' or 'SECURESPHERE')
   * @returns {Object} API configuration
   */
  getApiConfig(service) {
    const prefix = service.toUpperCase();
    return {
      baseUrl: this.get(`${prefix}_API_BASE_URL`),
      apiKey: this.get(`${prefix}_API_KEY`),
      apiSecret: this.get(`${prefix}_API_SECRET`),
      userAgent: this.get(`${prefix}_API_USER_AGENT`),
      timeout: this.get(`${prefix}_API_TIMEOUT`)
    };
  }
}

// Create and export singleton instance
export const envLoader = new EnvironmentLoader(); 
