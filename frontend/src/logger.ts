/**
 * Logging Middleware created in Pre-Test Setup stage.
 * Used to avoid inbuilt console loggers.
 */
class Logger {
    info(message: string, data: any = {}) {
        console.log(`[INFO] ${new Date().toISOString()} - ${message} - ${JSON.stringify(data)}`);
    }

    error(message: string, error: any = {}) {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message} - ${JSON.stringify(error)}`);
    }

    warn(message: string, data: any = {}) {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message} - ${JSON.stringify(data)}`);
    }
}

export const logger = new Logger();
