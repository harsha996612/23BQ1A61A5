/**
 * Logging Middleware — Pre-Test Setup Stage
 * 
 * Custom logger implementation. Use of inbuilt language loggers 
 * or console logging is NOT allowed per assessment rules.
 * This module provides structured logging with timestamps and levels.
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'app.log');

function formatEntry(level, message, meta) {
    const timestamp = new Date().toISOString();
    const metaStr = meta && Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : '';
    return `[${level}] ${timestamp} — ${message}${metaStr}`;
}

function writeLog(entry) {
    // Write to stdout/stderr AND persist to file
    process.stdout.write(entry + '\n');
    fs.appendFileSync(LOG_FILE, entry + '\n');
}

const logger = {
    info(message, meta = {}) {
        writeLog(formatEntry('INFO', message, meta));
    },
    warn(message, meta = {}) {
        writeLog(formatEntry('WARN', message, meta));
    },
    error(message, meta = {}) {
        writeLog(formatEntry('ERROR', message, meta));
    },
    debug(message, meta = {}) {
        writeLog(formatEntry('DEBUG', message, meta));
    }
};

/**
 * Express Logging Middleware
 * Logs every incoming HTTP request with method, URL, status, and duration.
 */
function loggingMiddleware(req, res, next) {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${method} ${originalUrl} ${res.statusCode}`, {
            duration: `${duration}ms`,
            ip: req.ip
        });
    });

    next();
}

module.exports = { logger, loggingMiddleware };
