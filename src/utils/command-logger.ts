import { createLogger, LogLevel } from './logger';
import { LOG_LEVEL } from '../config';

// Create a logger for commands
const commandLogger = createLogger('Command', LOG_LEVEL);

// Command execution times for measuring performance
const commandExecutionTimes = new Map<string, number>();

/**
 * Log the start of a command execution
 * @param command The command name
 * @param params Optional parameters for the command
 */
export function logCommandStart(command: string, params?: Record<string, any>): void {
    commandLogger.logCommandStart(command, params);
    commandExecutionTimes.set(command, Date.now());
}

/**
 * Log the end of a command execution
 * @param command The command name
 */
export function logCommandEnd(command: string): void {
    const startTime = commandExecutionTimes.get(command);
    if (startTime) {
        const executionTime = Date.now() - startTime;
        commandLogger.logCommandEnd(command, executionTime);
        commandExecutionTimes.delete(command);
    } else {
        commandLogger.logCommandEnd(command);
    }
}

/**
 * Higher-order function to wrap command handlers with logging
 * @param commandName The name of the command
 * @param handler The command handler function
 * @returns A wrapped handler function with logging
 */
export function withCommandLogging<T extends any[], R>(
    commandName: string,
    handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
        try {
            // Log command start
            logCommandStart(commandName, args.length > 0 ? { args: args.map(arg => 
                typeof arg === 'object' ? 
                    (arg && 'message_id' in arg ? { message_id: arg.message_id } : arg) : 
                    arg
            ) } : undefined);
            
            // Execute the command
            const result = await handler(...args);
            
            // Log command end
            logCommandEnd(commandName);
            
            return result;
        } catch (error) {
            // Log error
            commandLogger.error(`Error in command ${commandName}: ${error}`);
            
            // Log command end with error
            logCommandEnd(commandName);
            
            // Re-throw the error
            throw error;
        }
    };
}

/**
 * Set the log level for command logging
 * @param level The log level to set
 */
export function setCommandLogLevel(level: LogLevel): void {
    commandLogger.setLogLevel(level);
} 