/**
 * Production-ready logging utility
 * Logs are only shown in development mode or when explicitly enabled
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: Date;
}

class Logger {
  private isDevelopment: boolean;
  private isEnabled: boolean;
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.isEnabled = this.isDevelopment || import.meta.env.VITE_ENABLE_LOGGING === 'true';
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data !== undefined) {
      return `${prefix} ${message}`;
    }
    return `${prefix} ${message}`;
  }

  private addToHistory(level: LogLevel, message: string, data?: unknown): void {
    this.logs.push({
      level,
      message,
      data,
      timestamp: new Date(),
    });

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  debug(message: string, data?: unknown): void {
    if (!this.isEnabled) return;

    this.addToHistory('debug', message, data);

    if (this.isDevelopment) {
      if (data !== undefined) {
        console.log(this.formatMessage('debug', message), data);
      } else {
        console.log(this.formatMessage('debug', message));
      }
    }
  }

  info(message: string, data?: unknown): void {
    if (!this.isEnabled) return;

    this.addToHistory('info', message, data);

    if (this.isDevelopment) {
      if (data !== undefined) {
        console.info(this.formatMessage('info', message), data);
      } else {
        console.info(this.formatMessage('info', message));
      }
    }
  }

  warn(message: string, data?: unknown): void {
    this.addToHistory('warn', message, data);

    if (data !== undefined) {
      console.warn(this.formatMessage('warn', message), data);
    } else {
      console.warn(this.formatMessage('warn', message));
    }
  }

  error(message: string, error?: unknown): void {
    this.addToHistory('error', message, error);

    if (error !== undefined) {
      console.error(this.formatMessage('error', message), error);
    } else {
      console.error(this.formatMessage('error', message));
    }
  }

  getHistory(): LogEntry[] {
    return [...this.logs];
  }

  clearHistory(): void {
    this.logs = [];
  }
}

// Export a singleton instance
export const logger = new Logger();

// Export convenience functions
export const logDebug = (message: string, data?: unknown) => logger.debug(message, data);
export const logInfo = (message: string, data?: unknown) => logger.info(message, data);
export const logWarn = (message: string, data?: unknown) => logger.warn(message, data);
export const logError = (message: string, error?: unknown) => logger.error(message, error);
