// Breach Monitoring Service
// Handles all breach detection and monitoring functionality

import { getBreachApiConfig, ENV } from '../config/environment.js';

export class BreachMonitoringService {
  constructor() {
    this.config = getBreachApiConfig();
    this.isDebugEnabled = ENV.isDebugEnabled();
  }

  /**
   * Extract email addresses from credentials array
   * @param {Array} credentials - Array of credential objects
   * @returns {Set} Set of unique email addresses
   */
  extractEmailsFromCredentials(credentials) {
    const emails = new Set();
    
    credentials.forEach(cred => {
      const username = (cred.username || '').trim();
      if (username.includes('@') && username.includes('.')) {
        emails.add(username.toLowerCase());
      }
    });
    
    return emails;
  }

  /**
   * Check a single email for breaches using XposedOrNot API
   * @param {string} email - Email address to check
   * @returns {Promise<Object>} Breach check result
   */
  async checkEmailForBreaches(email) {
    try {
      if (this.isDebugEnabled) {
        
      }
      
      const url = `${this.config.baseUrl}/breach-analytics?email=${encodeURIComponent(email)}`;
      const timeout = this.config.timeout;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const headers = {
        'Accept': 'application/json',
        'User-Agent': this.config.userAgent
      };

      // Add API key if configured
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 200) {
        const data = await response.json();
        if (this.isDebugEnabled) {
          
        }
        return {
          email: email,
          data: data,
          success: true
        };
      } else if (response.status === 404) {
        // No breaches found (this is good)
        if (this.isDebugEnabled) {
          
        }
        return {
          email: email,
          data: null,
          success: true,
          message: 'No breaches found'
        };
      } else {
        
        return {
          email: email,
          error: `API returned status ${response.status}`,
          success: false
        };
      }
      
    } catch (error) {
      console.error(`❌ [BREACH] Error checking ${email}:`, error.message);
      return {
        email: email,
        error: error.message.includes('aborted') ? 'Request timeout' : error.message,
        success: false
      };
    }
  }

  /**
   * Check multiple emails for breaches with rate limiting
   * @param {Array} credentials - Array of credential objects
   * @returns {Promise<Object>} Breach check results for all emails
   */
  async checkCredentialsForBreaches(credentials) {
    try {
      
      
      // Extract email addresses from credentials
      const emails = this.extractEmailsFromCredentials(credentials);
      
      
      if (emails.size === 0) {
        return {
          success: true,
          results: [],
          message: 'No email addresses found in saved credentials',
          totalEmails: 0
        };
      }
      
      const results = [];
      const maxConcurrent = this.config.maxConcurrentChecks;
      const delayBetweenRequests = this.config.delayBetweenRequests;
      
      // Process emails in batches if concurrent limit is set
      if (maxConcurrent > 1 && emails.size > maxConcurrent) {
        const emailArray = Array.from(emails);
        for (let i = 0; i < emailArray.length; i += maxConcurrent) {
          const batch = emailArray.slice(i, i + maxConcurrent);
          const batchPromises = batch.map(email => this.checkEmailForBreaches(email));
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
          
          // Add delay between batches
          if (i + maxConcurrent < emailArray.length) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
          }
        }
      } else {
        // Check each email for breaches with rate limiting
        for (const email of emails) {
          const result = await this.checkEmailForBreaches(email);
          results.push(result);
          
          // Add delay between requests to be respectful to the API
          if (emails.size > 1) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
          }
        }
      }
      
      
      
      return {
        success: true,
        results: results,
        totalEmails: emails.size
      };
      
    } catch (error) {
      console.error('❌ [BREACH] Breach monitoring error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fetch recent breaches from XposedOrNot API
   * @param {number} limit - Number of recent breaches to fetch (default: 5)
   * @returns {Promise<Object>} Recent breaches data
   */
  async fetchRecentBreaches(limit = 5) {
    try {
      if (this.isDebugEnabled) {
        
      }
      
      const url = `${this.config.baseUrl}/breaches`;
      const timeout = this.config.recentBreachesTimeout;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const headers = {
        'Accept': 'application/json',
        'User-Agent': this.config.userAgent
      };

      // Add API key if configured
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 200) {
        const data = await response.json();
        const recentBreaches = (data.exposedBreaches || []).slice(0, limit);
        
        
        
        return {
          success: true,
          breaches: recentBreaches
        };
      } else {
        
        return {
          success: false,
          error: `API returned status ${response.status}`
        };
      }
      
    } catch (error) {
      console.error('❌ [BREACH] Recent breaches fetch error:', error);
      return {
        success: false,
        error: error.message.includes('aborted') ? 'Request timeout' : error.message
      };
    }
  }

  /**
   * Parse breach statistics from API results
   * @param {Array} results - Array of breach check results
   * @returns {Object} Breach statistics
   */
  parseBreachStatistics(results) {
    const stats = {
      totalChecked: results.length,
      totalBreached: 0,
      totalClean: 0,
      totalErrors: 0,
      breachedEmails: [],
      cleanEmails: [],
      errorEmails: []
    };
    
    results.forEach(result => {
      if (!result.success) {
        stats.totalErrors++;
        stats.errorEmails.push({
          email: result.email,
          error: result.error
        });
      } else if (result.data && result.data.BreachesSummary && result.data.BreachesSummary.site) {
        const breachesSite = result.data.BreachesSummary.site;
        const hasBreaches = (typeof breachesSite === 'string' && breachesSite.trim().length > 0) ||
                           (Array.isArray(breachesSite) && breachesSite.length > 0);
        
        if (hasBreaches) {
          stats.totalBreached++;
          stats.breachedEmails.push({
            email: result.email,
            breaches: result.data.BreachesSummary.site,
            details: result.data.ExposedBreaches?.breaches_details || []
          });
        } else {
          stats.totalClean++;
          stats.cleanEmails.push(result.email);
        }
      } else {
        stats.totalClean++;
        stats.cleanEmails.push(result.email);
      }
    });
    
    return stats;
  }

  /**
   * Format breach data for UI display
   * @param {Array} results - Raw breach check results
   * @returns {Array} Formatted results for UI
   */
  formatBreachDataForUI(results) {
    return results.map((result, index) => ({
      id: index,
      email: result.email,
      success: result.success,
      error: result.error,
      hasBreaches: result.success && result.data && 
                   result.data.BreachesSummary && 
                   result.data.BreachesSummary.site &&
                   (typeof result.data.BreachesSummary.site === 'string' ? 
                    result.data.BreachesSummary.site.trim().length > 0 :
                    Array.isArray(result.data.BreachesSummary.site) && result.data.BreachesSummary.site.length > 0),
      breachData: result.data,
      formattedForDisplay: this.formatSingleBreachForDisplay(result)
    }));
  }

  /**
   * Format a single breach result for display
   * @param {Object} result - Single breach check result
   * @returns {Object} Formatted display data
   */
  formatSingleBreachForDisplay(result) {
    if (!result.success || !result.data) {
      return {
        status: 'error',
        message: result.error || 'Unknown error',
        breachCount: 0,
        details: []
      };
    }

    const data = result.data;
    const breachesSite = data.BreachesSummary?.site || '';
    const breachesList = typeof breachesSite === 'string' && breachesSite.trim()
      ? breachesSite.split(';').map(s => s.trim()).filter(s => s.length > 0)
      : Array.isArray(breachesSite) ? breachesSite : [];

    if (breachesList.length === 0) {
      return {
        status: 'clean',
        message: 'No breaches found',
        breachCount: 0,
        details: []
      };
    }

    const details = breachesList.map(site => {
      const breachDetail = data.ExposedBreaches?.breaches_details?.find(d =>
        (d.breach || '').toString().trim() === site.toString()
      );

      return {
        site: site,
        domain: breachDetail?.domain || '',
        details: breachDetail?.details || '',
        exposedData: breachDetail?.xposed_data || '',
        exposedDate: breachDetail?.xposed_date || '',
        verified: breachDetail?.verified || false
      };
    });

    return {
      status: 'breached',
      message: `${breachesList.length} breach${breachesList.length > 1 ? 'es' : ''} found`,
      breachCount: breachesList.length,
      details: details,
      riskMetrics: {
        riskLabel: data.BreachMetrics?.risk?.[0]?.risk_label || 'Unknown',
        riskScore: data.BreachMetrics?.risk?.[0]?.risk_score || 0
      }
    };
  }
}

// Create and export singleton instance
export const breachService = new BreachMonitoringService(); 
