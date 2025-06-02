// Password Management UI Module
// Handles password/credential UI components and user interactions

import { ENV } from '../config/environment.js';

export class PasswordUI {
  constructor() {
    this.currentCredentials = [];
    this.isDebugEnabled = ENV.isDebugEnabled();
    this.filteredCredentials = [];
    this.currentSearchQuery = '';
    this.currentFilters = {};
    this.refreshCallback = null;
    this.walletRefreshCallback = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      this.setupPasswordEventListeners();
      this.setupSearchAndFilter();
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ [PASSWORD-UI] Failed to initialize:', error);
    }
  }

  /**
   * Setup password-related event listeners
   */
  setupPasswordEventListeners() {
    // Add password form
    const addPasswordBtn = document.getElementById('addPasswordBtn');
    if (addPasswordBtn) {
      addPasswordBtn.addEventListener('click', () => this.handleAddPassword());
    }

    const generatePasswordBtn = document.getElementById('generatePasswordBtn');
    if (generatePasswordBtn) {
      generatePasswordBtn.addEventListener('click', () => this.handleGeneratePassword());
    }

    // Add wallet form
    const addWalletBtn = document.getElementById('addWalletBtn');
    if (addWalletBtn) {
      addWalletBtn.addEventListener('click', () => this.handleAddWallet());
    }

    const generateWalletSeedBtn = document.getElementById('generateWalletSeed');
    if (generateWalletSeedBtn) {
      generateWalletSeedBtn.addEventListener('click', () => this.handleGenerateWalletSeed());
    }

    // Backup and restore
    const createBackupBtn = document.getElementById('createBackupBtn');
    if (createBackupBtn) {
      createBackupBtn.addEventListener('click', () => this.handleCreateBackup());
    }

    const restoreBackupBtn = document.getElementById('restoreBackupBtn');
    if (restoreBackupBtn) {
      restoreBackupBtn.addEventListener('click', () => this.handleRestoreBackup());
    }

    // Export and import
    const exportBtn = document.getElementById('exportCredentialsBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.handleExportCredentials());
    }

    const importBtn = document.getElementById('importCredentialsBtn');
    if (importBtn) {
      importBtn.addEventListener('click', () => this.handleImportCredentials());
    }

    // Password generation settings
    this.setupPasswordGeneratorControls();

    // Toggle password visibility
    this.setupPasswordVisibilityToggles();

    // Refresh credentials
    const refreshBtn = document.getElementById('refreshCredentialsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshCredentials());
    }

    this.setupDeleteHandlers();
    this.setupBackupHandlers();
    this.setupExportImportHandlers();
  }

  /**
   * Setup search and filtering functionality
   */
  setupSearchAndFilter() {
    // Search input
    const searchInput = document.getElementById('credentialsSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleFilter(e.target.dataset.filter));
    });

    // Sort dropdown
    const sortSelect = document.getElementById('credentialsSort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => this.handleSort(e.target.value));
    }
  }

  /**
   * Setup password generator controls
   */
  setupPasswordGeneratorControls() {
    const lengthSlider = document.getElementById('passwordLength');
    const lengthDisplay = document.getElementById('passwordLengthDisplay');
    const checkboxes = ['includeUppercase', 'includeLowercase', 'includeNumbers', 'includeSymbols'];

    if (lengthSlider && lengthDisplay) {
      lengthSlider.addEventListener('input', (e) => {
        lengthDisplay.textContent = e.target.value;
      });
    }

    checkboxes.forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.addEventListener('change', () => this.updatePasswordPreview());
      }
    });
  }

  /**
   * Setup password visibility toggles
   */
  setupPasswordVisibilityToggles() {
    const toggleBtns = document.querySelectorAll('.toggle-password');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => this.togglePasswordVisibility(e.target));
    });
  }

  /**
   * Handle add password
   */
  async handleAddPassword() {
    try {
      const website = document.getElementById('passwordWebsite').value.trim();
      const username = document.getElementById('passwordUsername').value.trim();
      const password = document.getElementById('passwordPassword').value;
      const notes = document.getElementById('passwordNotes').value.trim();

      // Basic validation
      if (!website || !username || !password) {
        this.showMessage('Please fill in all required fields (Website, Username, Password)', 'error');
        return;
      }

      this.showButtonLoading('addPasswordBtn', 'Adding password...');

      const newCredential = {
        type: 'login',
        website,
        username,
        password,
        notes,
        timestamp: new Date().toISOString(),
        id: Date.now().toString()
      };

      // Add to current credentials and store
      const updatedCredentials = [...this.currentCredentials, newCredential];
      
      const response = await chrome.runtime.sendMessage({
        type: 'STORE_CREDENTIALS',
        credentials: updatedCredentials
      });

      if (response.success) {
        this.currentCredentials = updatedCredentials;
        this.showMessage('Password added successfully!', 'success');
        this.clearPasswordForm();
        this.displayCredentials();
        this.updateStatistics();
      } else {
        throw new Error(response.error || 'Failed to store password');
      }
    } catch (error) {
      console.error('❌ [PASSWORD-UI] Error adding password:', error);
      this.showMessage('Failed to add password: ' + error.message, 'error');
    } finally {
      this.hideButtonLoading('addPasswordBtn', 'Add Password');
    }
  }

  /**
   * Handle add wallet
   */
  async handleAddWallet() {
    try {
      const name = document.getElementById('walletName').value.trim();
      const seedPhrase = document.getElementById('walletSeedPhrase').value.trim();
      const notes = document.getElementById('walletNotes').value.trim();

      // Basic validation
      if (!name || !seedPhrase) {
        this.showMessage('Please fill in wallet name and seed phrase', 'error');
        return;
      }

      this.showButtonLoading('addWalletBtn', 'Adding wallet...');

      const newWallet = {
        type: 'wallet',
        name,
        seedPhrase,
        notes,
        timestamp: new Date().toISOString(),
        id: Date.now().toString()
      };

      // Add to current credentials and store
      const updatedCredentials = [...this.currentCredentials, newWallet];
      
      const response = await chrome.runtime.sendMessage({
        type: 'STORE_CREDENTIALS',
        credentials: updatedCredentials
      });

      if (response.success) {
        this.currentCredentials = updatedCredentials;
        this.showMessage('Wallet added successfully!', 'success');
        this.clearWalletForm();
        this.displayCredentials();
        this.updateStatistics();
      } else {
        throw new Error(response.error || 'Failed to store wallet');
      }
    } catch (error) {
      console.error('❌ [PASSWORD-UI] Error adding wallet:', error);
      this.showMessage('Failed to add wallet: ' + error.message, 'error');
    } finally {
      this.hideButtonLoading('addWalletBtn', 'Add Wallet');
    }
  }

  /**
   * Handle password generation
   */
  async handleGeneratePassword() {
    try {
      const length = parseInt(document.getElementById('passwordLength')?.value || 12);
      const options = {
        uppercase: document.getElementById('includeUppercase')?.checked !== false,
        lowercase: document.getElementById('includeLowercase')?.checked !== false,
        numbers: document.getElementById('includeNumbers')?.checked !== false,
        symbols: document.getElementById('includeSymbols')?.checked === true
      };

      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_PASSWORD',
        options: { length, ...options }
      });

      if (response.success) {
        const passwordInput = document.getElementById('passwordPassword');
        if (passwordInput) {
          passwordInput.value = response.password;
        }
        
        const generatedPasswordDisplay = document.getElementById('generatedPassword');
        if (generatedPasswordDisplay) {
          generatedPasswordDisplay.value = response.password;
        }
        
        this.showMessage('Password generated successfully!', 'success');
      } else {
        throw new Error(response.error || 'Failed to generate password');
      }
    } catch (error) {
      console.error('❌ [PASSWORD-UI] Error generating password:', error);
      this.showMessage('Failed to generate password: ' + error.message, 'error');
    }
  }

  /**
   * Handle wallet seed generation
   */
  async handleGenerateWalletSeed() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GENERATE_SEED' });
      
      if (response.seedPhrase) {
        const walletSeedInput = document.getElementById('walletSeedPhrase');
        if (walletSeedInput) {
          walletSeedInput.value = response.seedPhrase;
        }
        this.showMessage('Wallet seed phrase generated successfully!', 'success');
      } else {
        throw new Error(response.error || 'Failed to generate seed phrase');
      }
    } catch (error) {
      console.error('❌ [PASSWORD-UI] Error generating wallet seed:', error);
      this.showMessage('Failed to generate wallet seed: ' + error.message, 'error');
    }
  }

  /**
   * Handle search functionality
   * @param {string} query - Search query
   */
  handleSearch(query) {
    this.currentSearchQuery = query;
    this.filterAndDisplayCredentials();
  }

  /**
   * Handle filtering
   * @param {string} filter - Filter type
   */
  handleFilter(filter) {
    if (filter === 'all') {
      this.currentFilters = {};
    } else {
      this.currentFilters = { type: filter };
    }
    
    // Update filter button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    this.filterAndDisplayCredentials();
  }

  /**
   * Handle sorting
   * @param {string} sortBy - Sort criteria
   */
  handleSort(sortBy) {
    let sortedCredentials = [...this.filteredCredentials];
    
    switch (sortBy) {
      case 'name':
        sortedCredentials.sort((a, b) => (a.website || a.name || '').localeCompare(b.website || b.name || ''));
        break;
      case 'date':
        sortedCredentials.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        break;
      case 'type':
        sortedCredentials.sort((a, b) => (a.type || 'login').localeCompare(b.type || 'login'));
        break;
      default:
        break;
    }
    
    this.filteredCredentials = sortedCredentials;
    this.renderCredentialsList();
  }

  /**
   * Filter and display credentials based on current search and filters
   */
  async filterAndDisplayCredentials() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEARCH_CREDENTIALS',
        query: this.currentSearchQuery,
        filters: this.currentFilters
      });

      if (response.success) {
        this.filteredCredentials = response.results;
        this.renderCredentialsList();
      } else {
        this.filteredCredentials = this.currentCredentials.filter(cred => {
          // Fallback client-side filtering
          const matchesQuery = !this.currentSearchQuery || 
            [cred.website, cred.username, cred.name, cred.notes]
              .join(' ').toLowerCase().includes(this.currentSearchQuery.toLowerCase());
          
          const matchesFilter = !this.currentFilters.type || 
            (cred.type || 'login') === this.currentFilters.type;
          
          return matchesQuery && matchesFilter;
        });
        this.renderCredentialsList();
      }
    } catch (error) {
      console.error('❌ [PASSWORD-UI] Error filtering credentials:', error);
      this.filteredCredentials = this.currentCredentials;
      this.renderCredentialsList();
    }
  }

  /**
   * Display all credentials
   */
  displayCredentials() {
    this.filteredCredentials = this.currentCredentials;
    this.renderCredentialsList();
  }

  /**
   * Render credentials list in the UI
   */
  renderCredentialsList() {
    const container = document.getElementById('credentialsList');
    if (!container) return;

    if (this.filteredCredentials.length === 0) {
      container.innerHTML = `
        <div class="no-credentials">
          <div class="no-credentials-icon">🔐</div>
          <h3>No credentials found</h3>
          <p>${this.currentSearchQuery ? 'Try adjusting your search or filters' : 'Add your first password or wallet to get started'}</p>
        </div>
      `;
      return;
    }

    const credentialsHTML = this.filteredCredentials.map(cred => this.renderCredentialItem(cred)).join('');
    container.innerHTML = credentialsHTML;

    // Attach event listeners to credential items
    this.attachCredentialItemListeners();
  }

  /**
   * Render a single credential item
   * @param {Object} credential - Credential object
   * @returns {string} HTML string
   */
  renderCredentialItem(credential) {
    const isWallet = credential.type === 'wallet';
    const icon = isWallet ? '🏦' : '🔑';
    const title = isWallet ? credential.name : credential.website;
    const subtitle = isWallet ? 'Wallet' : credential.username;
    
    return `
      <div class="credential-item" data-id="${credential.id}">
        <div class="credential-icon">${icon}</div>
        <div class="credential-info">
          <h4 class="credential-title">${this.escapeHtml(title)}</h4>
          <p class="credential-subtitle">${this.escapeHtml(subtitle)}</p>
          ${credential.notes ? `<p class="credential-notes">${this.escapeHtml(credential.notes)}</p>` : ''}
        </div>
        <div class="credential-actions">
          <button class="btn-icon copy-btn" data-id="${credential.id}" title="Copy ${isWallet ? 'seed phrase' : 'password'}">
            📋
          </button>
          <button class="btn-icon edit-btn" data-id="${credential.id}" title="Edit">
            ✏️
          </button>
          <button class="btn-icon delete-btn" data-id="${credential.id}" title="Delete">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to credential items
   */
  attachCredentialItemListeners() {
    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleCopyCredential(e.target.dataset.id));
    });

    // Edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleEditCredential(e.target.dataset.id));
    });

    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleDeleteCredential(e.target.dataset.id));
    });
  }

  /**
   * Handle copy credential
   * @param {string} credentialId - Credential ID
   */
  async handleCopyCredential(credentialId) {
    try {
      const credential = this.currentCredentials.find(c => c.id === credentialId);
      if (!credential) {
        this.showMessage('Credential not found', 'error');
        return;
      }

      const textToCopy = credential.type === 'wallet' ? credential.seedPhrase : credential.password;
      await navigator.clipboard.writeText(textToCopy);
      
      const type = credential.type === 'wallet' ? 'Seed phrase' : 'Password';
      this.showMessage(`${type} copied to clipboard!`, 'success');
    } catch (error) {
      console.error('❌ [PASSWORD-UI] Error copying credential:', error);
      this.showMessage('Failed to copy to clipboard', 'error');
    }
  }

  /**
   * Handle edit credential
   * @param {string} credentialId - Credential ID
   */
  handleEditCredential(credentialId) {
    const credential = this.currentCredentials.find(c => c.id === credentialId);
    if (!credential) {
      this.showMessage('Credential not found', 'error');
      return;
    }

    // Fill edit form with credential data
    if (credential.type === 'wallet') {
      this.fillWalletForm(credential);
      this.showSection('addWallet');
    } else {
      this.fillPasswordForm(credential);
      this.showSection('addPassword');
    }
  }

  /**
   * Handle delete credential
   * @param {string} credentialId - Credential ID
   */
  async handleDeleteCredential(credentialId) {
    try {
      const credential = this.currentCredentials.find(c => c.id === credentialId);
      if (!credential) {
        this.showMessage('Credential not found', 'error');
        return;
      }

      const confirmMessage = `Are you sure you want to delete "${credential.website || credential.name}"?`;
      if (!confirm(confirmMessage)) {
        return;
      }

      // Remove from current credentials and store
      const updatedCredentials = this.currentCredentials.filter(c => c.id !== credentialId);
      
      const response = await chrome.runtime.sendMessage({
        type: 'STORE_CREDENTIALS',
        credentials: updatedCredentials
      });

      if (response.success) {
        this.currentCredentials = updatedCredentials;
        this.showMessage('Credential deleted successfully!', 'success');
        this.filterAndDisplayCredentials();
        this.updateStatistics();
      } else {
        throw new Error(response.error || 'Failed to delete credential');
      }
    } catch (error) {
      console.error('❌ [PASSWORD-UI] Error deleting credential:', error);
      this.showMessage('Failed to delete credential: ' + error.message, 'error');
    }
  }

  /**
   * Handle create backup
   */
  async handleCreateBackup() {
    try {
      this.showButtonLoading('createBackupBtn', 'Creating backup...');

      const response = await chrome.runtime.sendMessage({ type: 'CREATE_BACKUP' });

      if (response.success) {
        this.showMessage('Backup created successfully!', 'success');
      } else {
        throw new Error(response.error || 'Failed to create backup');
      }
    } catch (error) {
      console.error('❌ [PASSWORD-UI] Error creating backup:', error);
      this.showMessage('Failed to create backup: ' + error.message, 'error');
    } finally {
      this.hideButtonLoading('createBackupBtn', 'Create Backup');
    }
  }

  /**
   * Handle export credentials
   */
  async handleExportCredentials() {
    try {
      const format = document.getElementById('exportFormat')?.value || 'json';
      const excludePasswords = document.getElementById('excludePasswords')?.checked || false;
      
      this.showButtonLoading('exportCredentialsBtn', 'Exporting...');

      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_CREDENTIALS',
        format,
        options: { excludePasswords }
      });

      if (response.success) {
        // Create download link
        const blob = new Blob([response.data], { type: response.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.filename;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showMessage('Credentials exported successfully!', 'success');
      } else {
        throw new Error(response.error || 'Failed to export credentials');
      }
    } catch (error) {
      console.error('❌ [PASSWORD-UI] Error exporting credentials:', error);
      this.showMessage('Failed to export credentials: ' + error.message, 'error');
    } finally {
      this.hideButtonLoading('exportCredentialsBtn', 'Export');
    }
  }

  /**
   * Handle import credentials
   */
  async handleImportCredentials() {
    try {
      const fileInput = document.getElementById('importFile');
      if (!fileInput.files.length) {
        this.showMessage('Please select a file to import', 'error');
        return;
      }

      const file = fileInput.files[0];
      const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
      const replace = document.getElementById('replaceExisting')?.checked || false;

      this.showButtonLoading('importCredentialsBtn', 'Importing...');

      const fileContent = await this.readFileAsText(file);

      const response = await chrome.runtime.sendMessage({
        type: 'IMPORT_CREDENTIALS',
        data: fileContent,
        format,
        options: { replace }
      });

      if (response.success) {
        this.showMessage(`Imported ${response.imported} credentials successfully!`, 'success');
        await this.refreshCredentials();
      } else {
        throw new Error(response.error || 'Failed to import credentials');
      }
    } catch (error) {
      console.error('❌ [PASSWORD-UI] Error importing credentials:', error);
      this.showMessage('Failed to import credentials: ' + error.message, 'error');
    } finally {
      this.hideButtonLoading('importCredentialsBtn', 'Import');
    }
  }

  /**
   * Refresh credentials from storage
   */
  async refreshCredentials() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS' });
      
      if (response.error) {
        throw new Error(response.error);
      }

      this.currentCredentials = response.credentials || [];
      this.displayCredentials();
      this.updateStatistics();
      
    } catch (error) {
      console.error('❌ [PASSWORD-UI] Error refreshing credentials:', error);
      this.showMessage('Failed to refresh credentials: ' + error.message, 'error');
    }
  }

  /**
   * Update password preview
   */
  updatePasswordPreview() {
    // This would update a password preview in the generator
    this.handleGeneratePassword();
  }

  /**
   * Toggle password visibility
   * @param {HTMLElement} button - Toggle button
   */
  togglePasswordVisibility(button) {
    const input = button.parentElement.querySelector('input[type="password"], input[type="text"]');
    if (!input) return;

    if (input.type === 'password') {
      input.type = 'text';
      button.textContent = '🙈';
    } else {
      input.type = 'password';
      button.textContent = '👁️';
    }
  }

  /**
   * Clear password form
   */
  clearPasswordForm() {
    const fields = ['passwordWebsite', 'passwordUsername', 'passwordPassword', 'passwordNotes'];
    fields.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.value = '';
    });
  }

  /**
   * Clear wallet form
   */
  clearWalletForm() {
    const fields = ['walletName', 'walletSeedPhrase', 'walletNotes'];
    fields.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.value = '';
    });
  }

  /**
   * Fill password form with data
   * @param {Object} credential - Credential data
   */
  fillPasswordForm(credential) {
    document.getElementById('passwordWebsite').value = credential.website || '';
    document.getElementById('passwordUsername').value = credential.username || '';
    document.getElementById('passwordPassword').value = credential.password || '';
    document.getElementById('passwordNotes').value = credential.notes || '';
  }

  /**
   * Fill wallet form with data
   * @param {Object} credential - Wallet data
   */
  fillWalletForm(credential) {
    document.getElementById('walletName').value = credential.name || '';
    document.getElementById('walletSeedPhrase').value = credential.seedPhrase || '';
    document.getElementById('walletNotes').value = credential.notes || '';
  }

  /**
   * Update statistics display
   */
  async updateStatistics() {
    try {
      const stats = this.calculateStatistics();
      
      const totalElement = document.getElementById('totalCredentials');
      const loginsElement = document.getElementById('totalLogins');
      const walletsElement = document.getElementById('totalWallets');
      
      if (totalElement) totalElement.textContent = stats.total;
      if (loginsElement) loginsElement.textContent = stats.logins;
      if (walletsElement) walletsElement.textContent = stats.wallets;
      
    } catch (error) {
      console.error('❌ [PASSWORD-UI] Error updating statistics:', error);
    }
  }

  /**
   * Calculate credential statistics
   * @returns {Object} Statistics object
   */
  calculateStatistics() {
    return {
      total: this.currentCredentials.length,
      logins: this.currentCredentials.filter(c => (c.type || 'login') === 'login').length,
      wallets: this.currentCredentials.filter(c => c.type === 'wallet').length
    };
  }

  /**
   * Read file as text
   * @param {File} file - File to read
   * @returns {Promise<string>} File content
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Escape HTML characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show loading state on button
   * @param {string} buttonId - Button element ID
   * @param {string} message - Loading message
   */
  showButtonLoading(buttonId, message) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.disabled = true;
      button.textContent = message;
    }
  }

  /**
   * Hide loading state on button
   * @param {string} buttonId - Button element ID
   * @param {string} originalText - Original button text
   */
  hideButtonLoading(buttonId, originalText) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  /**
   * Show message to user (needs to be provided by the parent context)
   * @param {string} message - Message to show
   * @param {string} type - Message type (success, error, warning, info)
   */
  showMessage(message, type = 'info') {
    // This should be provided by the parent context that imports this module
    if (typeof window.showMessage === 'function') {
      window.showMessage(message, type);
    } else {
      }] ${message}`);
    }
  }

  /**
   * Show specific section (needs to be provided by parent context)
   * @param {string} sectionId - Section ID to show
   */
  showSection(sectionId) {
    if (typeof window.showSection === 'function') {
      window.showSection(sectionId);
    }
  }

  /**
   * Set current credentials
   * @param {Array} credentials - Array of credentials
   */
  setCredentials(credentials) {
    this.currentCredentials = credentials || [];
    this.displayCredentials();
    this.updateStatistics();
  }

  /**
   * Get current credentials
   * @returns {Array} Current credentials array
   */
  getCredentials() {
    return this.currentCredentials;
  }
}

// Create and export singleton instance
export const passwordUI = new PasswordUI(); 
