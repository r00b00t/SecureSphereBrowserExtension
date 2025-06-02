// Password Generator module

/**
 * Generates a random password based on specified options
 * @param {Object} options - Password generation options
 * @param {number} options.length - Length of the password (default: 12)
 * @param {boolean} options.includeUppercase - Include uppercase letters (default: true)
 * @param {boolean} options.includeLowercase - Include lowercase letters (default: true)
 * @param {boolean} options.includeNumbers - Include numbers (default: true)
 * @param {boolean} options.includeSymbols - Include special symbols (default: true)
 * @param {boolean} options.excludeSimilarChars - Exclude similar characters like 'l', '1', 'I', etc. (default: false)
 * @param {boolean} options.excludeAmbiguousChars - Exclude ambiguous symbols like {}, [], (), etc. (default: false)
 * @returns {string} - Generated password
 */
const generatePassword = (options = {}) => {
  // Default options
  const config = {
    length: options.length || 12,
    includeUppercase: options.includeUppercase !== false,
    includeLowercase: options.includeLowercase !== false,
    includeNumbers: options.includeNumbers !== false,
    includeSymbols: options.includeSymbols !== false,
    excludeSimilarChars: options.excludeSimilarChars || false,
    excludeAmbiguousChars: options.excludeAmbiguousChars || false
  };

  // Character sets
  const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
  const numberChars = '0123456789';
  const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  // Similar characters to exclude if option is enabled
  const similarChars = 'il1Lo0O';
  
  // Ambiguous characters to exclude if option is enabled
  const ambiguousChars = '{}[]()/\\\'\"~,;:.<>';

  // Build character pool based on options
  let charPool = '';
  
  if (config.includeUppercase) {
    charPool += config.excludeSimilarChars 
      ? uppercaseChars.split('').filter(char => !similarChars.includes(char)).join('') 
      : uppercaseChars;
  }
  
  if (config.includeLowercase) {
    charPool += config.excludeSimilarChars 
      ? lowercaseChars.split('').filter(char => !similarChars.includes(char)).join('') 
      : lowercaseChars;
  }
  
  if (config.includeNumbers) {
    charPool += config.excludeSimilarChars 
      ? numberChars.split('').filter(char => !similarChars.includes(char)).join('') 
      : numberChars;
  }
  
  if (config.includeSymbols) {
    let symbols = symbolChars;
    if (config.excludeAmbiguousChars) {
      symbols = symbols.split('').filter(char => !ambiguousChars.includes(char)).join('');
    }
    charPool += symbols;
  }

  // Ensure we have characters to work with
  if (charPool.length === 0) {
    throw new Error('No character sets selected for password generation');
  }

  // Generate password
  let password = '';
  const randomValues = new Uint32Array(config.length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < config.length; i++) {
    const randomIndex = randomValues[i] % charPool.length;
    password += charPool[randomIndex];
  }

  return password;
};

/**
 * Generates multiple password options with different configurations
 * @param {number} count - Number of password options to generate (default: 5)
 * @param {Object} baseOptions - Base options for all passwords
 * @returns {Array<Object>} - Array of password objects with value and description
 */
const generatePasswordOptions = (count = 5, baseOptions = {}) => {
  const passwordOptions = [];
  
  // Strong password (default)
  passwordOptions.push({
    value: generatePassword({ ...baseOptions }),
    description: 'Strong password (letters, numbers, symbols)'
  });
  
  // Easy to say (no numbers or special chars)
  passwordOptions.push({
    value: generatePassword({
      ...baseOptions,
      includeNumbers: false,
      includeSymbols: false
    }),
    description: 'Easy to say (no numbers or symbols)'
  });
  
  // Easy to read (no similar characters)
  passwordOptions.push({
    value: generatePassword({
      ...baseOptions,
      excludeSimilarChars: true
    }),
    description: 'Easy to read (no similar characters)'
  });
  
  // Numbers only
  passwordOptions.push({
    value: generatePassword({
      ...baseOptions,
      includeUppercase: false,
      includeLowercase: false,
      includeSymbols: false
    }),
    description: 'Numbers only'
  });
  
  // Extra strong (longer password)
  passwordOptions.push({
    value: generatePassword({
      ...baseOptions,
      length: Math.max(16, baseOptions.length || 16)
    }),
    description: 'Extra strong (longer password)'
  });
  
  return passwordOptions;
};

/**
 * Evaluates the strength of a password
 * @param {string} password - The password to evaluate
 * @returns {Object} - Object containing score (0-100) and feedback
 */
const evaluatePasswordStrength = (password) => {
  if (!password) return { score: 0, feedback: 'Password is empty' };
  
  let score = 0;
  const feedback = [];
  
  // Length check (up to 40 points)
  const lengthScore = Math.min(40, password.length * 4);
  score += lengthScore;
  
  if (password.length < 8) {
    feedback.push('Password is too short');
  }
  
  // Character variety checks (up to 60 points)
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSymbols = /[^A-Za-z0-9]/.test(password);
  
  if (hasUppercase) score += 10;
  if (hasLowercase) score += 10;
  if (hasNumbers) score += 10;
  if (hasSymbols) score += 10;
  
  if (!hasUppercase) feedback.push('Add uppercase letters');
  if (!hasLowercase) feedback.push('Add lowercase letters');
  if (!hasNumbers) feedback.push('Add numbers');
  if (!hasSymbols) feedback.push('Add symbols');
  
  // Variety bonus (up to 20 points)
  const charTypes = [hasUppercase, hasLowercase, hasNumbers, hasSymbols].filter(Boolean).length;
  score += charTypes * 5;
  
  // Final score adjustments
  score = Math.min(100, score);
  
  // Determine strength label
  let strengthLabel = 'weak';
  if (score >= 80) strengthLabel = 'strong';
  else if (score >= 60) strengthLabel = 'good';
  else if (score >= 40) strengthLabel = 'medium';
  else if (score >= 20) strengthLabel = 'weak';
  else strengthLabel = 'very weak';
  
  return {
    score,
    strengthLabel,
    feedback: feedback.length > 0 ? feedback : ['Password is strong']
  };
};

export {
  generatePassword,
  generatePasswordOptions,
  evaluatePasswordStrength
};
