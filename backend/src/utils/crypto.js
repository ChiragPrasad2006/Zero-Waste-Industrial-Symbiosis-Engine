import crypto from 'crypto';

const getKey = () => {
  const secret = process.env.EMAIL_SECRET || '32-char-secret-key-change-me!!';
  return crypto.createHash('sha256').update(secret).digest();
};

export const hashEmail = (email) =>
  crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

export const encryptEmail = (email) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(email.trim().toLowerCase(), 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decryptEmail = (payload) => {
  const [ivHex, encryptedHex] = payload.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), Buffer.from(ivHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
};

