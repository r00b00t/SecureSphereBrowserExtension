export class VaultUI {
  constructor() {
    this.isInitialized = false;
    this.elements = {};
  }

  async initialize(options = {}) {
    if (this.isInitialized) return;

    this.elements = {
      uploadBtn: document.getElementById('vaultUploadBtn'),
      testBtn: document.getElementById('vaultTestBtn'),
      refreshBtn: document.getElementById('vaultRefreshBtn'),
      fileInput: document.getElementById('vaultFileInput'),
      statusDiv: document.getElementById('vaultStatus'),
      progressDiv: document.getElementById('vaultProgress'),
      vaultList: document.getElementById('vaultList'),
      dropZone: this.createDropZone()
    };

    this.setupEventListeners();
    this.isInitialized = true;
    await this.listFiles();
  }

  createDropZone() {
    const uploadForm = document.querySelector('#fileVaultCard .modern-form');
    if (!uploadForm) return null;
    const dropZone = document.createElement('div');
    dropZone.className = 'vault-drop-zone';
    dropZone.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: 3px dashed var(--primary-green);
      border-radius: 12px;
      background: rgba(46, 125, 50, 0.1);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10;
      pointer-events: none;
    `;
    dropZone.innerHTML = `
      <div style="text-align: center; color: var(--primary-green); font-weight: 600; font-size: 18px;">
        ⬆️ Drop files here to upload
      </div>
    `;

    const formGroup = uploadForm.querySelector('.form-group');
    if (formGroup) {
      formGroup.style.position = 'relative';
      formGroup.appendChild(dropZone);
    }

    return dropZone;
  }

  setupEventListeners() {
    this.elements.uploadBtn?.addEventListener('click', () => this.handleUploadClick());
    this.elements.fileInput?.addEventListener('change', (e) => this.handleFileSelect(e));
    this.elements.refreshBtn?.addEventListener('click', () => this.listFiles());
    this.elements.testBtn?.addEventListener('click', () => this.testConnection());
    this.setupDragAndDrop();
  }

  setupDragAndDrop() {
    const uploadForm = document.querySelector('#fileVaultCard .modern-form');
    if (!uploadForm) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadForm.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      uploadForm.addEventListener(eventName, () => {
        if (this.elements.dropZone) {
          this.elements.dropZone.style.display = 'flex';
        }
        uploadForm.style.borderColor = 'var(--primary-green)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadForm.addEventListener(eventName, () => {
        if (this.elements.dropZone) {
          this.elements.dropZone.style.display = 'none';
        }
        uploadForm.style.borderColor = '';
      }, false);
    });

    uploadForm.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        this.handleFilesUpload(Array.from(files));
      }
    }, false);
  }

  handleUploadClick() {
    this.elements.fileInput?.click();
  }

  handleFileSelect(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.handleFilesUpload(Array.from(files));
    }
    event.target.value = '';
  }

  async handleFilesUpload(files) {
    if (!files || files.length === 0) {
      this.setStatus('No files selected', 'error');
      return;
    }

    try {
      await this.ensurePrivateKeyUnlocked();
      for (const file of files) {
        await this.uploadFile(file);
      }
      await this.listFiles();
    } catch (error) {
      this.setStatus(`Upload failed: ${error.message}`, 'error');
    }
  }

  async uploadFile(file) {
    try {
      await this.ensurePrivateKeyUnlocked();
      this.setProgress(`Uploading ${file.name}...`);

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      const cfg = await this.getRenterdConfig();
      const bucket = await this.getBucketName(cfg.mode);

      this.setProgress(`Uploading ${file.name} to vault...`);

      const res = await chrome.runtime.sendMessage({
        type: 'VAULT_UPLOAD',
        host: cfg.host,
        port: cfg.port,
        apiPassword: cfg.apiPassword,
        bucket,
        fileName: file.name,
        bytes: Array.from(bytes)
      });

      if (res.success) {
        this.setStatus(`Uploaded ${file.name}`, 'success');
      } else {
        throw new Error(res.error || 'Upload failed');
      }
    } catch (error) {
      this.setStatus(`Failed to upload ${file.name}: ${error.message}`, 'error');
      throw error;
    }
  }

  async getRenterdConfig() {
    const sync = await chrome.storage.sync.get([
      'renterdHost',
      'renterdPort',
      'renterdApiPassword',
      'vaultMode'
    ]);
    const host = sync.renterdHost || '127.0.0.1';
    const port = parseInt(sync.renterdPort || '9980');
    const apiPassword = sync.renterdApiPassword || '';
    return {
      host,
      port,
      apiPassword,
      mode: sync.vaultMode || 'SecureSphere'
    };
  }

  async getBucketName(mode) {
    const { userId } = await chrome.storage.local.get(['userId']);
    const res = await chrome.runtime.sendMessage({
      type: 'VAULT_COMPUTE_BUCKET',
      mode,
      userId
    });
    if (!res.success) {
      throw new Error(res.error || 'Bucket compute failed');
    }
    return res.bucket;
  }

  async ensurePrivateKeyUnlocked() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PRIVATE_KEY_STATUS' });
      if (!response || !response.hasPrivateKey) {
        throw new Error('Private key not available. Please unlock your vault with your seed phrase first.');
      }
    } catch (error) {
      if (error.message.includes('Private key not available')) {
        throw error;
      }
      throw new Error('Cannot access private key. Please ensure you are logged in and your vault is unlocked.');
    }
  }

  async listFiles() {
    try {
      const cfg = await this.getRenterdConfig();
      const bucket = await this.getBucketName(cfg.mode);

      const res = await chrome.runtime.sendMessage({
        type: 'VAULT_LIST',
        host: cfg.host,
        port: cfg.port,
        apiPassword: cfg.apiPassword,
        bucket
      });

      if (!res.success) {
        throw new Error(res.error);
      }

      this.renderVaultList(res.objects || [], cfg, bucket);
      this.setStatus('Vault list updated', 'success');
    } catch (error) {
      this.setStatus(`List error: ${error.message}`, 'error');
    }
  }

  renderVaultList(objects, cfg, bucket) {
    const list = this.elements.vaultList;
    if (!list) return;

    if (!objects.length) {
      list.innerHTML = '<div style="padding:12px; color: var(--text-secondary);">No files in vault yet.</div>';
      return;
    }

    list.innerHTML = objects.map(obj => {
      const name = obj.key.replace(/\.orig\d+$/, '');
      const size = this.formatFileSize(obj.size);
      const when = new Date(obj.modTime).toLocaleString();
      return `
        <div class="modern-item">
          <div class="item-header">
            <div class="item-title">${this.escapeHtml(name)}</div>
            <div class="item-actions">
              <button class="btn-sm" data-action="download" data-key="${encodeURIComponent(obj.key)}">⬇️ Download</button>
              <button class="btn-sm btn-danger" data-action="delete" data-key="${encodeURIComponent(obj.key)}">🗑️ Delete</button>
            </div>
          </div>
          <div style="font-size:12px; color: var(--text-secondary);">
            Size: ${size} • Modified: ${when}
          </div>
        </div>
      `;
      }).join('');

    list.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.getAttribute('data-action');
      const key = target.getAttribute('data-key');
      if (!action || !key) return;

      const realKey = decodeURIComponent(key);
      const cfg2 = await this.getRenterdConfig();
      const bucket2 = await this.getBucketName(cfg2.mode);

      if (action === 'download') {
        await this.downloadFile(cfg2, bucket2, realKey);
      } else if (action === 'delete') {
        await this.deleteFile(cfg2, bucket2, realKey);
      }
    });
  }

  async downloadFile(cfg, bucket, key) {
    try {
      this.setProgress('Downloading...');

      const res = await chrome.runtime.sendMessage({
        type: 'VAULT_DOWNLOAD',
        host: cfg.host,
        port: cfg.port,
        apiPassword: cfg.apiPassword,
        bucket,
        key
      });

      if (res.success && res.blob) {
        const uint8Array = new Uint8Array(res.blob);
        const blob = new Blob([uint8Array], { type: res.mimeType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.fileName || key.replace(/\.orig\d+$/, '');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.setStatus('Downloaded successfully', 'success');
      } else {
        throw new Error(res.error || 'Download failed');
      }
    } catch (error) {
      this.setStatus(`Download error: ${error.message}`, 'error');
    }
  }

  async deleteFile(cfg, bucket, key) {
    if (!confirm('Delete this file from vault?')) {
      return;
    }

    try {
      this.setProgress('Deleting...');

      const res = await chrome.runtime.sendMessage({
        type: 'VAULT_DELETE',
        host: cfg.host,
        port: cfg.port,
        apiPassword: cfg.apiPassword,
        bucket,
        key
      });

      if (res.success) {
        this.setStatus('Deleted successfully', 'success');
        await this.listFiles(); // Refresh list
      } else {
        throw new Error(res.error || 'Delete failed');
      }
    } catch (error) {
      this.setStatus(`Delete error: ${error.message}`, 'error');
    }
  }

  async testConnection() {
    try {
      this.setProgress('Testing connection...');

      const cfg = await this.getRenterdConfig();
      const res = await chrome.runtime.sendMessage({
        type: 'VAULT_TEST_CONNECTION',
        config: {
          host: cfg.host,
          port: cfg.port,
          apiPassword: cfg.apiPassword
        }
      });

      if (res.success) {
        this.setStatus(`Connected via ${res.endpoint}`, 'success');
      } else {
        this.setStatus(`Connection failed: ${res.error || res.status}`, 'error');
      }
    } catch (error) {
      this.setStatus(`Test failed: ${error.message}`, 'error');
    }
  }

  setStatus(msg, type = 'success') {
    const statusDiv = this.elements.statusDiv;
    if (!statusDiv) return;

    statusDiv.textContent = msg;
    statusDiv.className = `status-message ${type}`;
    statusDiv.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }

  setProgress(msg) {
    const progressDiv = this.elements.progressDiv;
    if (!progressDiv) return;

    progressDiv.textContent = msg;
    progressDiv.className = 'status-message success';
    progressDiv.style.display = 'block';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export singleton instance
export const vaultUI = new VaultUI();

