const crypto = require('crypto');
const config = require('../config');

// Using AES-256-CBC
const ALGORITHM = 'aes-256-cbc';
// Generate a consistent 32-byte key from the jwtSecret
const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(config.jwtSecret)).digest('base64').substr(0, 32);

function encryptUrl(text) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Combine IV and encrypted text, then encode to Base64URL
    const combined = Buffer.concat([iv, encrypted]);
    return combined.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
}

function decryptUrl(text) {
  try {
    // Revert Base64URL to Base64
    let base64 = text.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    
    const combined = Buffer.from(base64, 'base64');
    const iv = combined.subarray(0, 16);
    const encryptedText = combined.subarray(16);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (error) {
    // Soft fail for testing/fallback if it's not actually encrypted
    return text;
  }
}

module.exports = {
  encryptUrl,
  decryptUrl
};
