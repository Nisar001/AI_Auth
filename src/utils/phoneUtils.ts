export class PhoneUtils {
  /**
   * Parse a phone number input and return country code and phone number parts
   */
  static parsePhoneNumber(phoneInput: string): { countryCode: string; phoneNumber: string; fullPhone: string } {
    const sanitized = phoneInput.trim();
    
    if (sanitized.startsWith('+')) {
      // Extract country code (1-4 digits after +)
      const match = sanitized.match(/^(\+\d{1,4})(.+)$/);
      if (match) {
        return {
          countryCode: match[1],
          phoneNumber: match[2],
          fullPhone: sanitized
        };
      }
    }
    
    // If no country code found, return as is
    return {
      countryCode: '',
      phoneNumber: sanitized,
      fullPhone: sanitized
    };
  }

  /**
   * Generate all possible phone number formats for database search
   */
  static generateSearchFormats(phoneInput: string): string[] {
    const formats: string[] = [];
    const sanitized = phoneInput.trim();
    
    // Add original format
    formats.push(sanitized);
    
    // Add without + prefix if it exists
    if (sanitized.startsWith('+')) {
      formats.push(sanitized.substring(1));
    }
    
    // If it looks like a phone with country code, add split version
    const parsed = this.parsePhoneNumber(sanitized);
    if (parsed.countryCode && parsed.phoneNumber) {
      formats.push(parsed.phoneNumber);
    }
    
    // Remove duplicates
    return [...new Set(formats)];
  }

  /**
   * Check if a phone input matches a stored phone/country combination
   */
  static isPhoneMatch(
    inputPhone: string, 
    storedPhone: string, 
    storedCountryCode: string
  ): boolean {
    const input = inputPhone.trim();
    const stored = storedPhone.trim();
    const countryCode = storedCountryCode.trim();
    
    // Direct match
    if (input === stored) return true;
    
    // Full phone match (country code + phone)
    const fullStoredPhone = `${countryCode}${stored}`;
    if (input === fullStoredPhone) return true;
    
    // Input with + matches full stored phone
    if (input.startsWith('+') && input.substring(1) === fullStoredPhone) return true;
    
    // Input without + matches stored phone
    if (input.startsWith('+')) {
      const inputWithoutPlus = input.substring(1);
      if (inputWithoutPlus === stored) return true;
      if (inputWithoutPlus === fullStoredPhone) return true;
    }
    
    // Parse input and check components
    const parsed = this.parsePhoneNumber(input);
    if (parsed.countryCode === countryCode && parsed.phoneNumber === stored) {
      return true;
    }
    
    return false;
  }

  /**
   * Normalize phone number for storage (how registration stores it)
   */
  static normalizeForStorage(phoneInput: string, countryCodeInput: string): { phone: string; countryCode: string } {
    let phone = phoneInput.trim();
    let countryCode = countryCodeInput.trim();
    
    // If phone starts with the country code, remove it
    if (countryCode && phone.startsWith(countryCode)) {
      phone = phone.substring(countryCode.length);
    }
    
    // Remove + from phone if present
    if (phone.startsWith('+')) {
      phone = phone.substring(1);
    }
    
    // Ensure country code starts with +
    if (countryCode && !countryCode.startsWith('+')) {
      countryCode = '+' + countryCode;
    }
    
    return { phone, countryCode };
  }

  /**
   * Format phone number for display
   */
  static formatForDisplay(phone: string, countryCode: string): string {
    const normalized = this.normalizeForStorage(phone, countryCode);
    return `${normalized.countryCode}${normalized.phone}`;
  }
}
