import { isSupabaseConfigured } from './supabase';

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export function handleSupabaseError(error: any, context: string = 'operation'): never {
  if (!isSupabaseConfigured) {
    throw new ConfigurationError(
      'Database not configured. Please set up your Supabase environment variables. Visit /diagnostics for help.'
    );
  }

  if (error?.message?.includes('Failed to fetch')) {
    throw new DatabaseError(
      'Unable to connect to database. Please check your internet connection and Supabase configuration.',
      error
    );
  }

  if (error?.message?.includes('Invalid API key')) {
    throw new ConfigurationError(
      'Invalid database credentials. Please verify your Supabase configuration at /diagnostics.'
    );
  }

  if (error?.code === 'PGRST301') {
    throw new DatabaseError(
      'Database query error. Please ensure your database schema is properly set up.',
      error
    );
  }

  if (error?.code === 'PGRST116') {
    throw new DatabaseError(
      'No data found or you do not have permission to access this data.',
      error
    );
  }

  if (error?.message) {
    throw new DatabaseError(
      `Failed to ${context}: ${error.message}`,
      error
    );
  }

  throw new DatabaseError(
    `An unexpected error occurred during ${context}. Please try again or contact support.`,
    error
  );
}

export function getFriendlyErrorMessage(error: any): string {
  if (error instanceof ConfigurationError) {
    return error.message;
  }

  if (error instanceof DatabaseError) {
    return error.message;
  }

  if (!isSupabaseConfigured) {
    return 'Database connection not configured. Please visit the diagnostics page for setup instructions.';
  }

  if (error?.message?.includes('Failed to fetch')) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  if (error?.message?.includes('Invalid API key')) {
    return 'Database authentication failed. Please check your configuration.';
  }

  if (error?.message) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
}

export function isConfigurationError(error: any): boolean {
  return (
    error instanceof ConfigurationError ||
    !isSupabaseConfigured ||
    error?.message?.includes('Invalid API key') ||
    error?.message?.includes('not configured')
  );
}
