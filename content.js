// Form detection and field identification
const findLoginForms = () => {
  const forms = document.querySelectorAll('form');
  return Array.from(forms).filter(form => {
    const inputs = form.querySelectorAll('input');
    const hasPasswordField = Array.from(inputs).some(input => input.type === 'password');
    const hasUsernameField = Array.from(inputs).some(input =>
      input.type === 'text' || input.type === 'email' || input.name.toLowerCase().includes('user')
    );
    return hasPasswordField && hasUsernameField;
  });
};

// Field identification helpers
const { savePassword } = require('./lib/password');

const findPasswordField = (form) => {
  return form.querySelector('input[type="password"]');
};

const findUsernameField = (form) => {
  const usernameSelectors = [
    'input[type="email"]',
    'input[type="text"][name*="user"]',
    'input[type="text"][name*="email"]',
    'input[type="text"]'
  ];
  
  for (const selector of usernameSelectors) {
    const field = form.querySelector(selector);
    if (field) return field;
  }
  return null;
};

// Save password prompt
const createSavePrompt = () => {
  const prompt = document.createElement('div');
  prompt.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    padding: 15px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 10000;
    font-family: system-ui;
  `;
  return prompt;
};

// Handle form submission
const handleFormSubmit = async (form) => {
  const usernameField = findUsernameField(form);
  const passwordField = findPasswordField(form);
  
  if (!usernameField || !passwordField) return;
  
  const credentials = {
    url: window.location.origin,
    username: usernameField.value,
    password: passwordField.value
  };
  
  const prompt = createSavePrompt();
  prompt.innerHTML = `
    <p>Do you want to save this password?</p>
    <button id="save-yes">Save</button>
    <button id="save-no">No thanks</button>
  `;
  
  document.body.appendChild(prompt);
  
  prompt.querySelector('#save-yes').addEventListener('click', async () => {
    try {
      // Check if extension context is available
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Extension context invalidated');
      }

      // Wrap message sending in a timeout to ensure context is still valid
      const response = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Message sending timeout'));
        }, 5000);

        try {
          chrome.runtime.sendMessage({
            type: 'SAVE_CREDENTIALS',
            credentials
          }, (response) => {
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      if (response && response.error) {
        throw new Error(response.error);
      }
      prompt.remove();
    } catch (error) {
      const isContextError = error.message.includes('Extension context invalidated') ||
                           error.message.includes('Message sending timeout') ||
                           error.message.includes('Extension context invalid');

      if (isContextError) {
        // Create error notification
        const errorPrompt = document.createElement('div');
        errorPrompt.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #ff4444;
          color: white;
          padding: 15px;
          border-radius: 5px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          z-index: 10000;
          font-family: system-ui;
        `;
        errorPrompt.innerHTML = `
          <p>Failed to save credentials. Please refresh the page and try again.</p>
          <button id="error-ok" style="background: white; color: #ff4444; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">OK</button>
        `;
        document.body.appendChild(errorPrompt);
        errorPrompt.querySelector('#error-ok').addEventListener('click', () => {
          errorPrompt.remove();
          prompt.remove();
        });
      } else {
        console.error('Error saving credentials:', error);
      }
    }
  });

  
  prompt.querySelector('#save-no').addEventListener('click', () => {
    prompt.remove();
  });
};

// Autofill functionality
const autofillCredentials = async (form) => {
  try {
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      throw new Error('Extension context invalidated');
    }

    const response = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Message sending timeout'));
      }, 5000);

      try {
        chrome.runtime.sendMessage({
          type: 'GET_CREDENTIALS'
        }, (response) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });

    if (response.error || !response.credentials) {
      
      return;
    }

    const currentUrl = window.location.origin;
    const credentials = Array.isArray(response.credentials) ? response.credentials : [];
    const matchingCredentials = credentials.find(cred => cred.url === currentUrl);

    if (matchingCredentials) {
      const usernameField = findUsernameField(form);
      const passwordField = findPasswordField(form);

      if (usernameField) usernameField.value = matchingCredentials.username;
      if (passwordField) passwordField.value = matchingCredentials.password;
    }
  } catch (error) {
    const isContextError = error.message.includes('Extension context invalidated') ||
                         error.message.includes('Message sending timeout') ||
                         error.message.includes('Extension context invalid');

    if (isContextError) {
      
    } else {
      console.error('Error during autofill:', error);
    }
  }
};

// Initialize
const init = () => {
  const forms = findLoginForms();
  
  forms.forEach(form => {
    // Handle form submission
    form.addEventListener('submit', () => handleFormSubmit(form));
    
    // Add autofill functionality
    const passwordField = findPasswordField(form);
    if (passwordField) {
      passwordField.addEventListener('focus', () => autofillCredentials(form));
    }
  });
};

// Run initialization
init();
