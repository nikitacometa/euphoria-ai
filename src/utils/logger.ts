type ColorFn = (text: string) => string;
type ChalkColors = {
    red: ColorFn;
    yellow: ColorFn;
    blue: ColorFn;
    green: ColorFn;
    gray: ColorFn;
};

// chalk 5 is ESM-only, so it is loaded lazily from this CommonJS build.
// Until (or unless) it loads, output is plain uncolored text.
let chalk: ChalkColors | undefined;
import('chalk')
    .then(module => {
        chalk = module.default;
    })
    .catch(() => {
        console.warn('[Logger] chalk failed to load, using uncolored output');
    });

// Log levels
export enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
    TRACE = 5
}

// Default log level (will be overridden by config)
const DEFAULT_LOG_LEVEL = LogLevel.INFO;

// Logger class
export class Logger {
    private context: string;
    private logLevel: LogLevel;

    constructor(context: string, logLevel: LogLevel = DEFAULT_LOG_LEVEL) {
        this.context = context;
        this.logLevel = logLevel;
    }

    // Format the log message with timestamp and context
    private formatMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] [${this.context}] ${message}`;
    }

    private colorize(color: keyof ChalkColors, text: string): string {
        return chalk ? chalk[color](text) : text;
    }

    // Error level logs
    error(message: string, ...args: unknown[]): void {
        if (this.logLevel >= LogLevel.ERROR) {
            console.error(this.colorize('red', this.formatMessage('ERROR', message)), ...args);
        }
    }

    // Warning level logs
    warn(message: string, ...args: unknown[]): void {
        if (this.logLevel >= LogLevel.WARN) {
            console.warn(this.colorize('yellow', this.formatMessage('WARN', message)), ...args);
        }
    }

    // Info level logs
    info(message: string, ...args: unknown[]): void {
        if (this.logLevel >= LogLevel.INFO) {
            console.info(this.colorize('blue', this.formatMessage('INFO', message)), ...args);
        }
    }

    // Debug level logs
    debug(message: string, ...args: unknown[]): void {
        if (this.logLevel >= LogLevel.DEBUG) {
            console.debug(this.colorize('green', this.formatMessage('DEBUG', message)), ...args);
        }
    }

    // Trace level logs (most verbose)
    trace(message: string, ...args: unknown[]): void {
        if (this.logLevel >= LogLevel.TRACE) {
            console.debug(this.colorize('gray', this.formatMessage('TRACE', message)), ...args);
        }
    }

    // Command execution logging
    logCommandStart(command: string, params?: Record<string, unknown>): void {
        if (this.logLevel >= LogLevel.INFO) {
            const paramsStr = params ? ` with params: ${JSON.stringify(params)}` : '';
            this.info(`Command started: ${command}${paramsStr}`);
        }
    }

    logCommandEnd(command: string, executionTimeMs?: number): void {
        if (this.logLevel >= LogLevel.INFO) {
            const timeStr = executionTimeMs ? ` (execution time: ${executionTimeMs}ms)` : '';
            this.info(`Command completed: ${command}${timeStr}`);
        }
    }

    // Set log level dynamically
    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }
}

// Create a default logger
export const logger = new Logger('App');

// Helper function to create a logger for a specific context
export function createLogger(context: string, logLevel?: LogLevel): Logger {
    return new Logger(context, logLevel);
}
