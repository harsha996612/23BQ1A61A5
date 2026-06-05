/**
 * Remote Logger implementation for the frontend.
 * Conforms to the mandatory "No inbuilt loggers or console.log" rule.
 * Sends logs directly to the custom Express Logging Middleware.
 */

const BACKEND_LOG_URL = 'http://localhost:5000/api/logs';

function sendLog(level: 'info' | 'error' | 'warn' | 'debug', message: string, meta?: any) {
    // Fire and forget, no await needed for logs
    fetch(BACKEND_LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, message, meta })
    }).catch(() => {
        // If logging fails (e.g. backend down), we swallow the error 
        // to strictly avoid using console.log() as per instructions.
    });
}

export const logger = {
    info: (message: string, meta?: any) => sendLog('info', message, meta),
    error: (message: string, meta?: any) => sendLog('error', message, meta),
    warn: (message: string, meta?: any) => sendLog('warn', message, meta),
    debug: (message: string, meta?: any) => sendLog('debug', message, meta),
};
