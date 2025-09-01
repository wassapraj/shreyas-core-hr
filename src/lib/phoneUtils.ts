/**
 * Converts a phone number to E.164 international format
 * @param phone - The phone number to convert
 * @param defaultCountry - Default country code (default: 'IN' for India)
 * @returns E.164 formatted phone number or null if invalid
 */
export function toE164(phone: string, defaultCountry: string = 'IN'): string | null {
  if (!phone) return null;
  
  // Strip all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If already starts with +, assume it's E.164 format
  if (cleaned.startsWith('+')) {
    return cleaned.length >= 7 ? cleaned : null;
  }
  
  // Remove any leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // Handle Indian numbers (10 digits)
  if (defaultCountry === 'IN' && cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  
  // Handle other countries - if we have digits, try to format
  if (cleaned.length >= 7) {
    // Default fallback to +91 for India if no country code detected
    return `+91${cleaned}`;
  }
  
  return null;
}

/**
 * Formats a WhatsApp message template with employee data
 * @param template - Message template with placeholders like {{first_name}}
 * @param employee - Employee data object
 * @returns Formatted message
 */
export function formatWhatsAppMessage(template: string, employee: any): string {
  return template
    .replace(/\{\{first_name\}\}/g, employee.first_name || 'there')
    .replace(/\{\{last_name\}\}/g, employee.last_name || '')
    .replace(/\{\{emp_code\}\}/g, employee.emp_code || '')
    .replace(/\{\{department\}\}/g, employee.department || '');
}

/**
 * Creates a WhatsApp URL with pre-filled message
 * @param phone - Phone number (will be converted to E.164)
 * @param message - Message to pre-fill
 * @returns WhatsApp URL
 */
export function createWhatsAppUrl(phone: string, message: string): string | null {
  const e164Phone = toE164(phone);
  if (!e164Phone) return null;
  
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${e164Phone.replace('+', '')}?text=${encodedMessage}`;
}