// API Configuration for SecureSphere Extension
// This file contains all API endpoints and configuration settings

export const API_CONFIG = {
  // Breach Monitoring APIs
  BREACH_MONITORING: {
    BASE_URL: process.env.BREACH_API_URL || 'https://api.example.com/v1',
    ENDPOINTS: {
      BREACH_ANALYTICS: '/breach-analytics',
      RECENT_BREACHES: '/breaches'
    },
    TIMEOUT: {
      BREACH_CHECK: 15000,     // 15 seconds
      RECENT_BREACHES: 10000   // 10 seconds
    },
    RATE_LIMIT: {
      DELAY_BETWEEN_REQUESTS: 1000  // 1 second delay between email checks
    },
    USER_AGENT: 'SecureSphere-Extension/1.0.0'
  },
  
  // SecureSphere Server Configuration
  SECURESPHERE: {
    BASE_URL: process.env.SECURESPHERE_API_URL || 'https://api.securesphere.example.com',
    ENDPOINTS: {
      REGISTER: '/auth/register',
      VERIFY: '/auth/verify',
      SYNC: '/data/sync'
    },
    TIMEOUT: 30000  // 30 seconds
  },
  
  // Extension Settings
  EXTENSION: {
    VERSION: '1.0.0',
    BUILD_NUMBER: '1.0.0-' + Date.now(),
    
    // Session Management
    SESSION: {
      DEFAULT_TIMEOUT: 30,  // 30 minutes
      TIMEOUT_OPTIONS: [15, 30, 60, 120, 240],  // Available timeout options in minutes
      MAX_RETRIES: 3
    },
    
    // Storage Configuration
    STORAGE: {
      MAX_BACKUPS: 10,
      ENCRYPTION_ITERATIONS: 100000
    },
    
    // UI Configuration
    UI: {
      POPUP_WIDTH: 380,
      POPUP_MIN_HEIGHT: 500,
      MESSAGE_DURATION: 4000,  // 4 seconds
      LOADING_TIMEOUT: 3000    // 3 seconds
    }
  }
};

// Helper function to get full API URL
export const getApiUrl = (service, endpoint) => {
  const config = API_CONFIG[service];
  if (!config) {
    throw new Error(`Unknown service: ${service}`);
  }
  
  const endpointPath = config.ENDPOINTS[endpoint];
  if (!endpointPath) {
    throw new Error(`Unknown endpoint: ${endpoint} for service: ${service}`);
  }
  
  return config.BASE_URL + endpointPath;
};

// Helper function to get timeout for specific operation
export const getTimeout = (service, operation = 'DEFAULT') => {
  const config = API_CONFIG[service];
  if (!config) return 10000; // Default 10 seconds
  
  if (config.TIMEOUT && typeof config.TIMEOUT === 'object') {
    return config.TIMEOUT[operation] || config.TIMEOUT.DEFAULT || 10000;
  }
  
  return config.TIMEOUT || 10000;
};

// Environment-specific configuration (can be overridden by .env)
export const ENV_CONFIG = {
  DEVELOPMENT: {
    DEBUG_LOGS: true,
    API_TIMEOUT_MULTIPLIER: 2,  // Double timeouts in development
    MOCK_API_RESPONSES: false
  },
  
  PRODUCTION: {
    DEBUG_LOGS: false,
    API_TIMEOUT_MULTIPLIER: 1,
    MOCK_API_RESPONSES: false
  }
};

// Get current environment configuration
export const getCurrentEnvConfig = () => {
  const isDevelopment = chrome.runtime.getManifest().version.includes('dev') || 
                       location.hostname === 'localhost';
  
  return isDevelopment ? ENV_CONFIG.DEVELOPMENT : ENV_CONFIG.PRODUCTION;
}; 
