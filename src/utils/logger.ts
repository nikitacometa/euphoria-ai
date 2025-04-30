// Using dynamic import for chalk
let chalk: any;
try {
    // This will be properly resolved at runtime
    import('chalk').then(module => {
        chalk = module.default;
    });
} catch (error) {
    // Fallback if chalk is not available
    chalk = {
        red: (text: string) => text,
        yellow: (text: string) => text,
        blue: (text: string) => text,
        green: (text: string) => text,
        gray: (text: string) => text
    };
}

// Log levels
export enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
    TRACE = 5
}

// String to LogLevel mapping
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
    'none': LogLevel.NONE,
    'error': LogLevel.ERROR,
    'warn': LogLevel.WARN,
    'info': LogLevel.INFO,
    'debug': LogLevel.DEBUG,
    'trace': LogLevel.TRACE
};

// Parse string log level to LogLevel enum
export function parseLogLevel(level: string | undefined): LogLevel {
    if (!level) return DEFAULT_LOG_LEVEL;
    const normalizedLevel = level.toLowerCase();
    return LOG_LEVEL_MAP[normalizedLevel] ?? DEFAULT_LOG_LEVEL;
}

// Default log level (will be overridden by config)
const DEFAULT_LOG_LEVEL = LogLevel.INFO;

// Default date format
const DEFAULT_DATE_FORMAT = 'dd/MM/yyyy HH:mm:ss';

// Logger class
export class Logger {
    private context: string;
    private logLevel: LogLevel;
    private dateFormat: string;

    constructor(
        context: string, 
        logLevel: LogLevel = DEFAULT_LOG_LEVEL,
        dateFormat: string = DEFAULT_DATE_FORMAT
    ) {
        this.context = context;
        this.logLevel = logLevel;
        this.dateFormat = dateFormat;
    }

    // Format the log message with timestamp and context
    private formatMessage(level: string, message: string): string {
        const date = new Date();
        const timestampStr = this.formatDate(date, this.dateFormat);
        return `[${timestampStr}][${level}][${this.context}] ${message}`;
    }

    // Format date according to the specified format string
    private formatDate(date: Date, format: string): string {
        const pad = (num: number) => num.toString().padStart(2, '0');
        
        const tokens: Record<string, string> = {
            yyyy: date.getUTCFullYear().toString(),
            MM: pad(date.getUTCMonth() + 1),
            dd: pad(date.getUTCDate()),
            HH: pad(date.getUTCHours()),
            mm: pad(date.getUTCMinutes()),
            ss: pad(date.getUTCSeconds()),
            SSS: date.getUTCMilliseconds().toString().padStart(3, '0')
        };

        return Object.entries(tokens).reduce((result, [token, value]) => {
            return result.replace(token, value);
        }, format);
    }

    // Error level logs
    error(message: string, ...args: any[]): void {
        if (this.logLevel >= LogLevel.ERROR) {
            console.error(chalk?.red ? chalk.red(this.formatMessage('ERROR', message)) : this.formatMessage('ERROR', message), ...args);
        }
    }

    // Warning level logs
    warn(message: string, ...args: any[]): void {
        if (this.logLevel >= LogLevel.WARN) {
            console.warn(chalk?.yellow ? chalk.yellow(this.formatMessage('WARN', message)) : this.formatMessage('WARN', message), ...args);
        }
    }

    // Info level logs
    info(message: string, ...args: any[]): void {
        if (this.logLevel >= LogLevel.INFO) {
            console.info(chalk?.blue ? chalk.blue(this.formatMessage('INFO', message)) : this.formatMessage('INFO', message), ...args);
        }
    }

    // Debug level logs
    debug(message: string, ...args: any[]): void {
        if (this.logLevel >= LogLevel.DEBUG) {
            console.debug(chalk?.green ? chalk.green(this.formatMessage('DEBUG', message)) : this.formatMessage('DEBUG', message), ...args);
        }
    }

    // Trace level logs (most verbose)
    trace(message: string, ...args: any[]): void {
        if (this.logLevel >= LogLevel.TRACE) {
            console.debug(chalk?.gray ? chalk.gray(this.formatMessage('TRACE', message)) : this.formatMessage('TRACE', message), ...args);
        }
    }

    // Command execution logging
    logCommandStart(command: string, params?: Record<string, any>): void {
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

    // Set date format dynamically
    setDateFormat(format: string): void {
        this.dateFormat = format;
    }
}

// Create a default logger
export const logger = new Logger('App');

// Helper function to create a logger for a specific context
export function createLogger(
    context: string, 
    logLevel?: LogLevel,
    dateFormat?: string
): Logger {
    return new Logger(context, logLevel, dateFormat);
} 