// Breach Monitoring UI Helpers
// Handles all UI-related breach monitoring functionality

import { breachService } from './breach-service.js';
import { ENV } from '../config/environment.js';

export class BreachMonitoringUI {
  constructor() {
    this.detectionCount = 0;
    this.lastCheckResults = [];
    this.isDebugEnabled = ENV.isDebugEnabled();
  }

  /**
   * Handle breach check button click
   * @param {Function} getCurrentCredentials - Function to get current credentials
   * @param {Function} showMessage - Function to show UI messages
   * @returns {Promise<void>}
   */
  async handleCheckBreaches(getCurrentCredentials, showMessage) {
    try {
      if (this.isDebugEnabled) {
        
      }
      
      // Show loading state
      const checkBtn = document.getElementById('checkBreachesBtn');
      if (checkBtn) {
        this.showButtonLoading(checkBtn, 'Checking...');
      }
      
      // Get current credentials
      const credentials = await getCurrentCredentials();
      
      if (!credentials || credentials.length === 0) {
        showMessage('No credentials found to check for breaches.', 'warning');
        return;
      }
      
      // Check for breaches
      const result = await breachService.checkCredentialsForBreaches(credentials);
      
      if (result.success) {
        this.lastCheckResults = result.results;
        this.updateDetectionCount(result.results);
        this.displayBreachResults(result.results);
        this.updateBreachStatistics(result.results);
        
        if (result.totalEmails === 0) {
          showMessage('No email addresses found in your credentials to check.', 'info');
        } else {
          const breachCount = this.countBreachedEmails(result.results);
          if (breachCount > 0) {
            showMessage(`⚠️ Found ${breachCount} breached email(s) out of ${result.totalEmails} checked. Review results below.`, 'warning');
          } else {
            showMessage(`✅ All ${result.totalEmails} email(s) are secure - no breaches found!`, 'success');
          }
        }
      } else {
        console.error('❌ [BREACH-UI] Breach check failed:', result.error);
        showMessage(`Breach check failed: ${result.error}`, 'error');
      }
      
    } catch (error) {
      console.error('❌ [BREACH-UI] Error in handleCheckBreaches:', error);
      showMessage('An error occurred while checking for breaches. Please try again.', 'error');
    } finally {
      // Hide loading state
      const checkBtn = document.getElementById('checkBreachesBtn');
      if (checkBtn) {
        this.hideButtonLoading(checkBtn, 'Check My Credentials');
      }
    }
  }

  /**
   * Count breached emails from results
   * @param {Array} results - Breach check results
   * @returns {number} Number of breached emails
   */
  countBreachedEmails(results) {
    return results.filter(result => {
      if (!result.success || !result.data) return false;
      
      const breachesSummary = result.data.BreachesSummary;
      if (!breachesSummary || !breachesSummary.site) return false;
      
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
   * Update the detection count display
   * @param {Array} results - Breach check results
   */
  updateDetectionCount(results) {
    const breachCount = this.countBreachedEmails(results);
    this.detectionCount = breachCount;
    
    const countElement = document.getElementById('detectionCount');
    if (countElement) {
      countElement.textContent = breachCount;
    }

    const activeBreachesElement = document.getElementById('activeBreaches');
    if (activeBreachesElement) {
      activeBreachesElement.textContent = breachCount;
    }
  }

  /**
   * Display breach results in the UI
   * @param {Array} results - Array of breach check results
   */
  displayBreachResults(results) {
    const resultsContainer = document.getElementById('breachResultsList');
    const resultsSection = document.getElementById('breachResults');
    
    if (!resultsContainer || !resultsSection) {
      console.error('❌ [BREACH-UI] Breach results containers not found');
      return;
    }
    
    // Clear previous results
    resultsContainer.innerHTML = '';
    
    if (results.length === 0) {
      resultsSection.style.display = 'none';
      return;
    }
    
    // Show results section
    resultsSection.style.display = 'block';
    
    // Format and display each result
    const formattedResults = breachService.formatBreachDataForUI(results);
    
    formattedResults.forEach((result, index) => {
      const resultElement = this.createBreachResultElement(result, index);
      resultsContainer.appendChild(resultElement);
    });
  }

  /**
   * Create a breach result element for display
   * @param {Object} result - Formatted breach result
   * @param {number} index - Result index
   * @returns {HTMLElement} Breach result element
   */
  createBreachResultElement(result, index) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'breach-result-item';
    
    const displayData = result.formattedForDisplay;
    
    // Determine icon and status based on result
    let icon, iconClass, statusText;
    
    if (displayData.status === 'error') {
      icon = '❌';
      iconClass = 'danger';
      statusText = displayData.message;
    } else if (displayData.status === 'clean') {
      icon = '✅';
      iconClass = 'safe';
      statusText = 'No breaches found';
    } else if (displayData.status === 'breached') {
      icon = displayData.breachCount > 3 ? '🚨' : '⚠️';
      iconClass = displayData.breachCount > 3 ? 'danger' : 'warning';
      statusText = displayData.message;
    } else {
      icon = '❓';
      iconClass = 'unknown';
      statusText = 'Unknown status';
    }
    
    resultDiv.innerHTML = `
      <div class="breach-result-header" onclick="toggleBreachDetails('breach-details-${index}')">
        <div class="breach-result-icon ${iconClass}">
          ${icon}
        </div>
        <div class="breach-result-content">
          <div class="breach-result-email">${result.email}</div>
          <div class="breach-result-summary">
            <span>${statusText}</span>
            ${displayData.breachCount > 0 ? `<span class="breach-count">${displayData.breachCount} detections</span>` : ''}
            ${displayData.riskMetrics ? `<span class="risk-level">Risk: ${displayData.riskMetrics.riskLabel} (${displayData.riskMetrics.riskScore})</span>` : ''}
          </div>
        </div>
      </div>
      ${displayData.breachCount > 0 ? this.createBreachDetailsHTML(displayData.details, index) : ''}
    `;
    
    return resultDiv;
  }

  /**
   * Create HTML for breach details
   * @param {Array} details - Array of breach detail objects
   * @param {number} index - Result index
   * @returns {string} HTML string for breach details
   */
  createBreachDetailsHTML(details, index) {
    if (!details || details.length === 0) return '';
    
    const breachItems = details.map(detail => `
      <div class="breach-item">
        <div class="breach-item-header">
          <span>⚠️</span>
          <span class="breach-item-title">${detail.site || 'Unknown Service'}</span>
        </div>
        ${detail.domain ? `<div class="breach-item-detail"><strong>Domain:</strong> ${detail.domain}</div>` : ''}
        ${detail.details ? `<div class="breach-item-detail"><strong>Details:</strong> ${detail.details}</div>` : ''}
        ${detail.exposedData ? `<div class="breach-item-detail"><strong>Exposed Data:</strong> ${detail.exposedData}</div>` : ''}
        ${detail.exposedDate ? `<div class="breach-item-detail"><strong>Date:</strong> ${detail.exposedDate}</div>` : ''}
        ${detail.verified !== undefined ? `<div class="breach-item-detail"><strong>Verified:</strong> ${detail.verified ? 'Yes' : 'No'}</div>` : ''}
      </div>
    `).join('');
    
    return `
      <div id="breach-details-${index}" class="breach-details">
        <h5 style="color: var(--text-primary); margin-bottom: 12px;">Breach Details:</h5>
        ${breachItems}
      </div>
    `;
  }

  /**
   * Update breach statistics display
   * @param {Array} results - Breach check results
   */
  updateBreachStatistics(results) {
    const stats = breachService.parseBreachStatistics(results);
    
    // Update various statistics displays if they exist
    const totalCheckedElement = document.getElementById('totalEmailsChecked');
    if (totalCheckedElement) {
      totalCheckedElement.textContent = stats.totalChecked;
    }
    
    const cleanEmailsElement = document.getElementById('cleanEmails');
    if (cleanEmailsElement) {
      cleanEmailsElement.textContent = stats.totalClean;
    }
    
    const breachedEmailsElement = document.getElementById('breachedEmails');
    if (breachedEmailsElement) {
      breachedEmailsElement.textContent = stats.totalBreached;
    }
    
    const errorEmailsElement = document.getElementById('errorEmails');
    if (errorEmailsElement) {
      errorEmailsElement.textContent = stats.totalErrors;
    }
  }

  /**
   * Load and display recent breaches
   * @returns {Promise<void>}
   */
  async loadRecentBreaches() {
    const recentBreachesList = document.getElementById('recentBreachesList');
    
    if (!recentBreachesList) {
      console.error('❌ [BREACH-UI] Recent breaches list container not found');
      return;
    }
    
    try {
      // Show loading state
      recentBreachesList.innerHTML = '<div class="loading-text">Loading recent breaches...</div>';
      
      // Fetch recent breaches
      const result = await breachService.fetchRecentBreaches(5);
      
      if (result.success && result.breaches.length > 0) {
        this.displayRecentBreaches(result.breaches);
      } else {
        recentBreachesList.innerHTML = `
          <div class="error-text">
            ${result.error || 'No recent breaches available'}
          </div>
        `;
      }
      
    } catch (error) {
      console.error('❌ [BREACH-UI] Error loading recent breaches:', error);
      recentBreachesList.innerHTML = '<div class="error-text">Failed to load recent breaches</div>';
    }
  }

  /**
   * Display recent breaches in the UI
   * @param {Array} breaches - Array of recent breach data
   */
  displayRecentBreaches(breaches) {
    const recentBreachesList = document.getElementById('recentBreachesList');
    
    if (!recentBreachesList) return;
    
    recentBreachesList.innerHTML = breaches.map(breach => `
      <div class="recent-breach-item">
        <div class="recent-breach-logo">
          ${breach.Name ? breach.Name.charAt(0).toUpperCase() : '🔓'}
        </div>
        <div class="recent-breach-content">
          <div class="recent-breach-title">${breach.Name || 'Unknown Service'}</div>
          <div class="recent-breach-domain">${breach.Domain || 'Domain not available'}</div>
          <div class="recent-breach-date">${breach.BreachDate || 'Date unknown'}</div>
          <div class="recent-breach-description">
            ${breach.Description ? 
              (breach.Description.length > 100 ? 
                breach.Description.substring(0, 100) + '...' : 
                breach.Description) : 
              'No description available'
            }
          </div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Show loading state on button
   * @param {HTMLElement} button - Button element
   * @param {string} loadingText - Loading text to display
   */
  showButtonLoading(button, loadingText) {
    const textSpan = button.querySelector('.btn-text');
    const loadingSpan = button.querySelector('.btn-loading');
    
    if (textSpan) textSpan.style.display = 'none';
    if (loadingSpan) {
      loadingSpan.textContent = loadingText;
      loadingSpan.style.display = 'inline';
    }
    
    button.disabled = true;
  }

  /**
   * Hide loading state on button
   * @param {HTMLElement} button - Button element
   * @param {string} originalText - Original button text
   */
  hideButtonLoading(button, originalText) {
    const textSpan = button.querySelector('.btn-text');
    const loadingSpan = button.querySelector('.btn-loading');
    
    if (textSpan) {
      textSpan.textContent = originalText;
      textSpan.style.display = 'inline';
    }
    if (loadingSpan) loadingSpan.style.display = 'none';
    
    button.disabled = false;
  }
}

/**
 * Global function to toggle breach details (called from HTML onclick)
 * @param {string} detailsId - ID of the details element to toggle
 */
window.toggleBreachDetails = function(detailsId) {
  const detailsElement = document.getElementById(detailsId);
  if (detailsElement) {
    detailsElement.classList.toggle('expanded');
  }
};

// Export singleton instance
export const breachUI = new BreachMonitoringUI(); 
