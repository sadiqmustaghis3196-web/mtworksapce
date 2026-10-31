interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  environment: 'development' | 'production';
  apiTimeout: number;
  maxRetries: number;
  rateLimitWindow: number;
  rateLimitMax: number;
}

class ConfigValidator {
  private static validateRequired(value: string | undefined, name: string): string {
    if (!value || value.trim() === '') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  }

  private static validateUrl(url: string, name: string): string {
    try {
      new URL(url);
      return url;
    } catch {
      throw new Error(`Invalid URL for ${name}: ${url}`);
    }
  }

  static validate(): EnvironmentConfig {
    const supabaseUrl = this.validateRequired(
      import.meta.env.VITE_SUPABASE_URL,
      'VITE_SUPABASE_URL'
    );

    const supabaseAnonKey = this.validateRequired(
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      'VITE_SUPABASE_ANON_KEY'
    );

    this.validateUrl(supabaseUrl, 'VITE_SUPABASE_URL');

    const environment = import.meta.env.PROD ? 'production' : 'development';

    return {
      supabaseUrl,
      supabaseAnonKey,
      environment,
      apiTimeout: environment === 'production' ? 30000 : 60000,
      maxRetries: environment === 'production' ? 3 : 1,
      rateLimitWindow: 60000,
      rateLimitMax: environment === 'production' ? 100 : 1000,
    };
  }

  static isProduction(): boolean {
    return import.meta.env.PROD === true;
  }

  static isDevelopment(): boolean {
    return !this.isProduction();
  }
}

export const config = ConfigValidator.validate();
export { ConfigValidator };
