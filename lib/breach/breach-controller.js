// Breach Monitoring Controller
// Handles background breach monitoring logic and message handling

import { breachService } from './breach-service.js';
import { ENV } from '../config/environment.js';

export class BreachController {
  constructor() {
    this.isEnabled = ENV.isFeatureEnabled('BREACH_MONITORING');
    this.setupMessageHandlers();
  }

  /**
   * Set up chrome runtime message handlers for breach monitoring
   */
  setupMessageHandlers() {
    if (!this.isEnabled) {
      
      return;
    }

    
  }

  /**
   * Handle CHECK_BREACHES message from popup
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   * @param {Object} userSession - Current user session with seedPhrase
   * @param {Function} getCredentials - Function to get user credentials
   */
  async handleCheckBreaches(message, sendResponse, userSession, getCredentials) {
    try {
      

      // Check if breach monitoring is enabled
      if (!this.isEnabled) {
        sendResponse({ 
          success: false, 
          error: 'Breach monitoring is disabled in configuration' 
        });
        return;
      }

      // Validate user session
      if (!userSession || !userSession.seedPhrase) {
        console.error('❌ [BREACH] No active user session');
        sendResponse({ 
          success: false, 
          error: 'No active user session. Please log in first.' 
        });
        return;
      }

      // Get current user credentials  
      
      const credentialsResult = await getCredentials(userSession.seedPhrase);
      
      if (!credentialsResult || !credentialsResult.success) {
        console.error('❌ [BREACH] Failed to retrieve credentials:', credentialsResult?.error);
        sendResponse({ 
          success: false, 
          error: 'Failed to retrieve saved credentials: ' + (credentialsResult?.error || 'Unknown error')
        });
        return;
      }

      const credentials = credentialsResult.credentials || [];
      

      // Perform breach check
      
      const result = await breachService.checkCredentialsForBreaches(credentials);
      
      if (result.success) {
        const breachCount = this.countBreachesInResults(result.results);
        
        
        // Add summary statistics to the result
        result.summary = {
          totalEmails: result.totalEmails || 0,
          breachCount: breachCount,
          cleanEmails: (result.totalEmails || 0) - breachCount,
          riskLevel: this.calculateRiskLevel(breachCount, result.totalEmails || 0)
        };
      } else {
        console.error('❌ [BREACH] Breach check failed:', result.error);
      }

      sendResponse(result);
      
    } catch (error) {
      console.error('❌ [BREACH] Error in breach check handler:', error);
      sendResponse({ 
        success: false, 
        error: 'Failed to check breaches: ' + error.message 
      });
    }
  }

  /**
   * Handle FETCH_RECENT_BREACHES message from popup
   * @param {Object} message - Message object from popup
   * @param {Function} sendResponse - Response callback function
   */
  async handleFetchRecentBreaches(message, sendResponse) {
    try {
      

      // Check if breach monitoring is enabled
      if (!this.isEnabled) {
        sendResponse({ 
          success: false, 
          error: 'Breach monitoring is disabled in configuration' 
        });
        return;
      }

      // Fetch recent breaches
      const result = await breachService.fetchRecentBreaches(message.limit || 5);
      
      if (result.success) {
        
      } else {
        console.error('❌ [BREACH] Failed to fetch recent breaches:', result.error);
      }

      sendResponse(result);
      
    } catch (error) {
      console.error('❌ [BREACH] Error in recent breaches handler:', error);
      sendResponse({ 
        success: false, 
        error: 'Failed to fetch recent breaches: ' + error.message 
      });
    }
  }

  /**
   * Count the number of breached emails in results
   * @param {Array} results - Array of breach check results
   * @returns {number} Number of emails with breaches
   */
  countBreachesInResults(results) {
    if (!Array.isArray(results)) return 0;
    
    return results.filter(result => {
      if (!result.success || !result.data) return false;
      
      const breachesSummary = result.data.BreachesSummary;
      if (!breachesSummary || !breachesSummary.site) return false;
      
      // Check if there are actual breaches
      const breachesSite = breachesSummary.site;
      if (typeof breachesSite === 'string') {
        return breachesSite.trim().length > 0;
      } else if (Array.isArray(breachesSite)) {
        return breachesSite.length > 0;
      }
      
      return false;
    }).length;
  }

  /**
   * Calculate risk level based on breach count and total emails
   * @param {number} breachCount - Number of breached emails
   * @param {number} totalEmails - Total number of emails checked
   * @returns {string} Risk level (LOW, MEDIUM, HIGH, CRITICAL)
   */
  calculateRiskLevel(breachCount, totalEmails) {
    if (breachCount === 0) return 'NONE';
    
    const percentage = totalEmails > 0 ? (breachCount / totalEmails) * 100 : 0;
    
    if (percentage >= 75) return 'CRITICAL';
    if (percentage >= 50) return 'HIGH';
    if (percentage >= 25) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Check if breach monitoring is enabled
   * @returns {boolean} Whether breach monitoring is enabled
   */
  isBreachMonitoringEnabled() {
    return this.isEnabled;
  }

  /**
   * Get breach monitoring configuration
   * @returns {Object} Current breach monitoring configuration
   */
  getConfiguration() {
    return {
      enabled: this.isEnabled,
      checkTimeout: ENV.get('BREACH_CHECK_TIMEOUT'),
      recentBreachesTimeout: ENV.get('RECENT_BREACHES_TIMEOUT'),
      delayBetweenRequests: ENV.get('BREACH_CHECK_DELAY'),
      maxConcurrentChecks: ENV.get('MAX_CONCURRENT_BREACH_CHECKS'),
      debugLogging: ENV.isDebugEnabled()
    };
  }

  /**
   * Get breach monitoring statistics
   * @param {Array} results - Breach check results
   * @returns {Object} Statistics about the breach check
   */
  getBreachStatistics(results) {
    if (!Array.isArray(results)) {
      return {
        totalChecked: 0,
        breachedEmails: 0,
        cleanEmails: 0,
        failedChecks: 0,
        riskLevel: 'NONE'
      };
    }

    const totalChecked = results.length;
    const breachedEmails = this.countBreachesInResults(results);
    const failedChecks = results.filter(r => !r.success).length;
    const cleanEmails = totalChecked - breachedEmails - failedChecks;

    return {
      totalChecked,
      breachedEmails,
      cleanEmails,
      failedChecks,
      riskLevel: this.calculateRiskLevel(breachedEmails, totalChecked),
      successRate: totalChecked > 0 ? ((totalChecked - failedChecks) / totalChecked * 100).toFixed(1) : 0
    };
  }
}

// Create and export singleton instance
export const breachController = new BreachController(); 
