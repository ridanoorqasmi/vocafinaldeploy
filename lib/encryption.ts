// Simple base64 encoding for development
export function encrypt(text: string): string {
  return Buffer.from(text).toString('base64')
}

export function decrypt(encryptedText: string): string {
  try {
    return Buffer.from(encryptedText, 'base64').toString('utf8')
  } catch (error) {
    // If decryption fails, return the original text (might be plain text)
    return encryptedText
  }
}

export function maskCredentials(config: any): any {
  const masked = { ...config }
  if (masked.password) masked.password = '***'
  if (masked.serviceKey) masked.serviceKey = '***'
  return masked
}