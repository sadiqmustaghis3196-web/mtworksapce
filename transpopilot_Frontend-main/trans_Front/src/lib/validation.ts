export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validators = {
  isString: (value: any): boolean => typeof value === 'string',

  isNumber: (value: any): boolean => typeof value === 'number' && !isNaN(value),

  isBoolean: (value: any): boolean => typeof value === 'boolean',

  isEmail: (value: any): boolean => {
    if (typeof value !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  isUUID: (value: any): boolean => {
    if (typeof value !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  },

  isLatitude: (value: any): boolean => {
    return validators.isNumber(value) && value >= -90 && value <= 90;
  },

  isLongitude: (value: any): boolean => {
    return validators.isNumber(value) && value >= -180 && value <= 180;
  },

  isPositiveNumber: (value: any): boolean => {
    return validators.isNumber(value) && value >= 0;
  },

  isNonEmptyString: (value: any): boolean => {
    return validators.isString(value) && value.trim().length > 0;
  },

  isUrl: (value: any): boolean => {
    if (typeof value !== 'string') return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  isDateString: (value: any): boolean => {
    if (typeof value !== 'string') return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  },

  isPhoneNumber: (value: any): boolean => {
    if (typeof value !== 'string') return false;
    const phoneRegex = /^\+?[\d\s\-()]+$/;
    return phoneRegex.test(value) && value.replace(/\D/g, '').length >= 10;
  },

  isVIN: (value: any): boolean => {
    if (typeof value !== 'string') return false;
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i;
    return vinRegex.test(value);
  },

  isLicensePlate: (value: any): boolean => {
    if (typeof value !== 'string') return false;
    return value.trim().length >= 2 && value.trim().length <= 10;
  },

  inRange: (min: number, max: number) => (value: any): boolean => {
    return validators.isNumber(value) && value >= min && value <= max;
  },

  minLength: (min: number) => (value: any): boolean => {
    return validators.isString(value) && value.length >= min;
  },

  maxLength: (max: number) => (value: any): boolean => {
    return validators.isString(value) && value.length <= max;
  },

  oneOf: <T>(options: T[]) => (value: any): boolean => {
    return options.includes(value);
  },

  optional: (validator: (value: any) => boolean) => (value: any): boolean => {
    return value === undefined || value === null || validator(value);
  },
};

export interface ValidationSchema {
  [field: string]: {
    validator: (value: any) => boolean;
    required?: boolean;
    message?: string;
  };
}

export function validate<T = any>(
  data: any,
  schema: ValidationSchema
): { valid: boolean; errors: string[]; data?: T } {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['Invalid data: must be an object'],
    };
  }

  const errors: string[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    const isRequired = rules.required !== false;

    if (value === undefined || value === null) {
      if (isRequired) {
        errors.push(rules.message || `${field} is required`);
      }
      continue;
    }

    if (!rules.validator(value)) {
      errors.push(rules.message || `${field} is invalid`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], data: data as T };
}

export const vehicleSchema: ValidationSchema = {
  vehicle_number: {
    validator: validators.isNonEmptyString,
    required: true,
    message: 'Vehicle number is required and must be a non-empty string',
  },
  make: {
    validator: validators.isNonEmptyString,
    required: true,
    message: 'Make is required',
  },
  model: {
    validator: validators.isNonEmptyString,
    required: true,
    message: 'Model is required',
  },
  year: {
    validator: validators.inRange(1900, new Date().getFullYear() + 1),
    required: true,
    message: 'Year must be a valid year',
  },
  vin: {
    validator: validators.optional(validators.isVIN),
    required: false,
    message: 'VIN must be a valid 17-character VIN',
  },
  license_plate: {
    validator: validators.optional(validators.isLicensePlate),
    required: false,
    message: 'License plate must be 2-10 characters',
  },
};

export const driverSchema: ValidationSchema = {
  first_name: {
    validator: validators.isNonEmptyString,
    required: true,
    message: 'First name is required',
  },
  last_name: {
    validator: validators.isNonEmptyString,
    required: true,
    message: 'Last name is required',
  },
  email: {
    validator: validators.optional(validators.isEmail),
    required: false,
    message: 'Email must be a valid email address',
  },
  phone: {
    validator: validators.optional(validators.isPhoneNumber),
    required: false,
    message: 'Phone must be a valid phone number',
  },
  license_number: {
    validator: validators.isNonEmptyString,
    required: true,
    message: 'License number is required',
  },
};

export const locationSchema: ValidationSchema = {
  latitude: {
    validator: validators.isLatitude,
    required: true,
    message: 'Latitude must be between -90 and 90',
  },
  longitude: {
    validator: validators.isLongitude,
    required: true,
    message: 'Longitude must be between -180 and 180',
  },
  speed: {
    validator: validators.optional(validators.isPositiveNumber),
    required: false,
    message: 'Speed must be a positive number',
  },
  heading: {
    validator: validators.optional(validators.inRange(0, 360)),
    required: false,
    message: 'Heading must be between 0 and 360',
  },
};

export const integrationCredentialsSchema: ValidationSchema = {
  provider_id: {
    validator: validators.isUUID,
    required: true,
    message: 'Provider ID must be a valid UUID',
  },
  api_key: {
    validator: validators.isNonEmptyString,
    required: true,
    message: 'API key is required',
  },
};

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .trim();
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj };

  for (const key in sanitized) {
    const value = sanitized[key];

    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value) as any;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value) as any;
    }
  }

  return sanitized;
}
