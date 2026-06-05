/**
 * Affordmed Notification Backend Server
 * 
 * Full Stack Assessment — Express.js + MongoDB backend
 * Uses the mandatory Logging Middleware (Pre-Test Setup stage).
 * Connects to MongoDB (Stage 2) for persistent notification storage.
 * Runs on port 5000.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { logger, loggingMiddleware } = require('./middleware/logger');
const { connectDB } = require('./db');
const notificationRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(loggingMiddleware);

// ─── Remote Logging Endpoint ─────────────────────────────────────
app.post('/api/logs', (req, res) => {
    const { level, message, meta } = req.body;
    if (logger[level]) {
        logger[level](`[FRONTEND] ${message}`, meta);
    } else {
        logger.info(`[FRONTEND] ${message}`, meta);
    }
    res.json({ status: 'logged' });
});

// ─── Routes ──────────────────────────────────────────────────────
app.use('/api/notifications', notificationRoutes);

// ─── Health check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    const mongoose = require('mongoose');
    res.json({
        status: 'ok',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// ─── 404 handler ─────────────────────────────────────────────────
app.use((req, res) => {
    logger.warn('Route not found', { method: req.method, url: req.originalUrl });
    res.status(404).json({ error: 'Route not found' });
});

// ─── Error handler ───────────────────────────────────────────────
app.use((err, req, res, _next) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
});

// ─── Start server ────────────────────────────────────────────────
async function start() {
    // Attempt MongoDB connection (graceful fallback if unavailable)
    await connectDB();

    app.listen(PORT, () => {
        logger.info(`Affordmed Notification Server running on http://localhost:${PORT}`);
    });
}

start();
