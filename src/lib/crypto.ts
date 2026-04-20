import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

function getKey(): Buffer {
  const key = process.env.PASSWORD_ENCRYPTION_KEY
  if (!key || key.length < 64) throw new Error('PASSWORD_ENCRYPTION_KEY must be at least 64 hex characters')
  return Buffer.from(key.slice(0, 64), 'hex')
}

export function encryptPassword(password: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  let encrypted = cipher.update(password, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

export function decryptPassword(encryptedPassword: string): string {
  const parts = encryptedPassword.split(':')
  if (parts.length !== 2) throw new Error('Invalid encrypted password format')
  const iv = Buffer.from(parts[0], 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  let decrypted = decipher.update(parts[1], 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
