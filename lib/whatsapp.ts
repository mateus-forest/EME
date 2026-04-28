export function sanitizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "")

  if (!digits) return ""
  if (digits.startsWith("55")) return digits

  return `55${digits}`
}

export function createWhatsAppUrl(number: string, message: string) {
  const sanitizedNumber = sanitizeWhatsAppNumber(number)
  const encodedMessage = encodeURIComponent(message)

  return `https://wa.me/${sanitizedNumber}?text=${encodedMessage}`
}
