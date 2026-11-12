const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const storage = new Map();

// Encryption key for secrets at rest: SECRET_KEY env var, otherwise a random key generated once
// per install and kept in data/secret.key (never committed, never logged).
function loadSecretKey() {
  if (process.env.SECRET_KEY) return crypto.createHash('sha256').update(process.env.SECRET_KEY).digest();
  const keyFile = path.join(require('./paths').dataDir(), 'secret.key');
  try {
    const hex = fs.readFileSync(keyFile, 'utf8').trim();
    if (/^[0-9a-f]{64}$/.test(hex)) return Buffer.from(hex, 'hex');
  } catch (e) { /* first run */ }
  const key = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(keyFile), { recursive: true });
  fs.writeFileSync(keyFile, key.toString('hex'), { mode: 0o600 });
  return key;
}
const secretKey = loadSecretKey();

module.exports = {
  create: (key, item) => {
    const keyMap = storage.get(key) || new Map();
    keyMap.set(item.id, item);
    storage.set(key, keyMap);
  },
  getAll: (key) => {
    const keyMap = storage.get(key);
    return keyMap ? Array.from(keyMap.values()) : [];
  },
  getById: (key, id) => {
    const keyMap = storage.get(key);
    if (!keyMap) return null;
    return keyMap.get(id);
  },
  update: (key, id, item) => {
    const keyMap = storage.get(key);
    if (!keyMap) return;
    keyMap.set(id, item);
  },
  remove: (key, id) => {
    const keyMap = storage.get(key);
    if (!keyMap) return;
    keyMap.delete(id);
  },
  encrypt: (text) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  },
  decrypt: (token) => {
    const [ivHex, authTagHex, encryptedHex] = token.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  }
};