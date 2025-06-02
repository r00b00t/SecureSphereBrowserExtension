// Generate encryption key and wallet keys from seed bytes
// The seed bytes should be generated in the background script using bip39.mnemonicToSeed
export const generateKeyFromSeedBytes = async (seed) => {
  if (!seed || seed.length < 64) { // Ensure seed is long enough for key material and keys
    throw new Error('Valid seed bytes (at least 64 bytes) are required for key generation.');
  }

  // Use the first 32 bytes of the seed for the AES-GCM key
  const keyMaterial = seed.slice(0, 32);

  // Generate encryption key for secure storage
  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true, // Key is extractable (false is generally recommended if not needed)
    ['encrypt', 'decrypt']
  );

  // Generate wallet keys (example, adjust as needed for actual wallet logic)
  // Ensure Buffer is available or use Uint8Array methods
  const privateKeyBuffer = seed.slice(0, 32);
  const publicKeyBuffer = seed.slice(32, 64);

  // Convert buffer to hex string (ensure Buffer polyfill is available or use Uint8Array conversion)
  // Using a simple hex conversion function if Buffer is not reliably available
  const toHexString = bytes => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

  const privateKey = '0x' + toHexString(privateKeyBuffer);
  const publicKey = '0x' + toHexString(publicKeyBuffer);

  return {
    encryptionKey,
    privateKey,
    publicKey
  };
};

// ============================================================================
// ANTI-STEALER PROTECTION: localStorage Encryption System
// ============================================================================

/**
 * Generate a master storage encryption key from user's seed phrase
 * This key is used to encrypt ALL localStorage data to prevent stealer attacks
 */
export const generateStorageEncryptionKey = async (seedPhrase) => {
  try {
    // Create a unique salt for storage encryption (different from credential encryption)
    const salt = new TextEncoder().encode('SecureSphere-LocalStorage-Protection-v1');
    
    // Import the seed phrase as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(seedPhrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive storage encryption key using PBKDF2 with high iterations
    const storageKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 250000, // High iteration count for stealer protection
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return storageKey;
  } catch (error) {
    console.error('Error generating storage encryption key:', error);
    throw new Error('Failed to generate storage encryption key');
  }
};

/**
 * Encrypt data before storing in localStorage
 * Protects against stealer malware that reads browser storage
 */
export const encryptStorageData = async (data, storageKey) => {
  try {
    const encoder = new TextEncoder();
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const dataBuffer = encoder.encode(dataString);
    
    // Generate random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      storageKey,
      dataBuffer
    );

    // Return encrypted data with IV and metadata
    return {
      encrypted: true,
      version: '1.0',
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encryptedData)),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error encrypting storage data:', error);
    throw new Error('Failed to encrypt storage data');
  }
};

/**
 * Decrypt data retrieved from localStorage
 * Returns original data if not encrypted (backward compatibility)
 */
export const decryptStorageData = async (encryptedObj, storageKey) => {
  try {
    // Check if data is encrypted
    if (!encryptedObj || typeof encryptedObj !== 'object' || !encryptedObj.encrypted) {
      // Return as-is for backward compatibility with unencrypted data
      return encryptedObj;
    }

    // Validate encrypted data structure
    if (!encryptedObj.iv || !encryptedObj.data) {
      throw new Error('Invalid encrypted data structure');
    }

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encryptedObj.iv) },
      storageKey,
      new Uint8Array(encryptedObj.data)
    );

    // Convert back to string and parse if needed
    const decryptedString = new TextDecoder().decode(decrypted);
    
    // Try to parse as JSON, return as string if not valid JSON
    try {
      return JSON.parse(decryptedString);
    } catch {
      return decryptedString;
    }
  } catch (error) {
    console.error('Error decrypting storage data:', error);
    throw new Error('Failed to decrypt storage data - possible corruption or wrong key');
  }
};

/**
 * Secure wrapper for chrome.storage.local.set
 * Automatically encrypts all data before storage
 */
export const secureStorageSet = async (items, storageKey) => {
  try {
    const encryptedItems = {};
    
    // Encrypt each item
    for (const [key, value] of Object.entries(items)) {
      // Skip encryption for certain metadata keys that need to be readable
      const skipEncryption = [
        'firstTimeSetup',
        'hasEncryptedStorage',
        'storageVersion'
      ];
      
      if (skipEncryption.includes(key)) {
        encryptedItems[key] = value;
      } else {
        encryptedItems[key] = await encryptStorageData(value, storageKey);
      }
    }

    // Mark that we're using encrypted storage
    encryptedItems.hasEncryptedStorage = true;
    encryptedItems.storageVersion = '1.0';

    // Store encrypted data
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(encryptedItems, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('Error in secure storage set:', error);
    throw error;
  }
};

/**
 * Secure wrapper for chrome.storage.local.get
 * Automatically decrypts data after retrieval
 */
export const secureStorageGet = async (keys, storageKey) => {
  try {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, async (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        try {
          const decryptedResult = {};
          
          // Decrypt each retrieved item
          for (const [key, value] of Object.entries(result)) {
            // Skip decryption for metadata keys
            const skipDecryption = [
              'firstTimeSetup',
              'hasEncryptedStorage', 
              'storageVersion'
            ];
            
            if (skipDecryption.includes(key)) {
              decryptedResult[key] = value;
            } else {
              decryptedResult[key] = await decryptStorageData(value, storageKey);
            }
          }

          resolve(decryptedResult);
        } catch (decryptError) {
          console.error('Error decrypting storage data:', decryptError);
          reject(decryptError);
        }
      });
    });
  } catch (error) {
    console.error('Error in secure storage get:', error);
    throw error;
  }
};

/**
 * Migrate existing unencrypted localStorage to encrypted format
 * This ensures backward compatibility and security upgrade
 */
export const migrateToEncryptedStorage = async (storageKey) => {
  try {
    
    
    // Get all current storage data
    const allData = await new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });

    // Check if already encrypted
    if (allData.hasEncryptedStorage) {
      
      return true;
    }

    // Encrypt all existing data
    const encryptedData = {};
    let itemsEncrypted = 0;

    for (const [key, value] of Object.entries(allData)) {
      // Skip metadata keys
      const skipEncryption = [
        'firstTimeSetup',
        'hasEncryptedStorage',
        'storageVersion'
      ];
      
      if (skipEncryption.includes(key)) {
        encryptedData[key] = value;
      } else if (value !== undefined && value !== null) {
        encryptedData[key] = await encryptStorageData(value, storageKey);
        itemsEncrypted++;
      }
    }

    // Mark as encrypted
    encryptedData.hasEncryptedStorage = true;
    encryptedData.storageVersion = '1.0';

    // Save encrypted data
    await new Promise((resolve, reject) => {
      chrome.storage.local.set(encryptedData, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });

    
    return true;
  } catch (error) {
    console.error('❌ Failed to migrate to encrypted storage:', error);
    throw new Error('Storage encryption migration failed: ' + error.message);
  }
};

/**
 * Verify storage encryption integrity
 * Tests encryption/decryption to ensure system is working
 */
export const verifyStorageEncryption = async (storageKey) => {
  try {
    
    
    // Test data
    const testData = {
      test: 'encryption_test',
      timestamp: Date.now(),
      array: [1, 2, 3],
      object: { nested: true }
    };

    // Encrypt test data
    const encrypted = await encryptStorageData(testData, storageKey);
    
    // Decrypt test data
    const decrypted = await decryptStorageData(encrypted, storageKey);
    
    // Verify integrity
    const isValid = JSON.stringify(testData) === JSON.stringify(decrypted);
    
    if (isValid) {
      
      return true;
    } else {
      console.error('❌ Storage encryption verification failed - data mismatch');
      return false;
    }
  } catch (error) {
    console.error('❌ Storage encryption verification error:', error);
    return false;
  }
};
