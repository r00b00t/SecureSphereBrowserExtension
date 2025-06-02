// Password management module

// Encryption/Decryption functions
const encryptData = async (data, key) => {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );
    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encryptedData))
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
};

const decryptData = async (encryptedObj, key) => {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encryptedObj.iv) },
      key,
      new Uint8Array(encryptedObj.data)
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
};

// Password storage operations
const savePassword = async (credentials, encryptionKey) => {
  try {
    const { passwords = [] } = await chrome.storage.local.get(['passwords']);
    const encryptedPassword = await encryptData(credentials.password, encryptionKey);
    const newCredential = {
      url: credentials.url,
      username: credentials.username,
      password: encryptedPassword,
      timestamp: Date.now()
    };
    passwords.push(newCredential);
    await chrome.storage.local.set({ passwords });
    return true;
  } catch (error) {
    console.error('Error saving password:', error);
    throw error;
  }
};

const getPasswords = async () => {
  try {
    const { passwords = [] } = await chrome.storage.local.get(['passwords']);
    return passwords;
  } catch (error) {
    console.error('Error getting passwords:', error);
    throw error;
  }
};

const deletePassword = async (index) => {
  try {
    const { passwords = [] } = await chrome.storage.local.get(['passwords']);
    passwords.splice(index, 1);
    await chrome.storage.local.set({ passwords });
    return true;
  } catch (error) {
    console.error('Error deleting password:', error);
    throw error;
  }
};

export {
  encryptData,
  decryptData,
  savePassword,
  getPasswords,
  deletePassword
};
