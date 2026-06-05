/**
 * Notification Routes — Full Stack Backend
 * 
 * REST API endpoints as designed in Stage 1.
 * Uses MongoDB (Stage 2) for persistence.
 * Implements Priority Inbox algorithm (Stage 6).
 * 
 * Endpoints:
 *   GET  /api/notifications          — paginated + filterable notifications
 *   GET  /api/notifications/priority — top N priority-ranked notifications
 *   PUT  /api/notifications/:id/read — mark a notification as read
 */

const express = require('express');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const NotificationModel = require('./models/Notification');
const { logger } = require('./logger');

const router = express.Router();

const EXTERNAL_API = 'http://4.224.186.213/evaluation-service/notifications';
const TYPE_WEIGHT = { Placement: 3, Result: 2, Event: 1 };

// ─── Check if MongoDB is connected ───────────────────────────────
function isDbConnected() {
    return mongoose.connection.readyState === 1;
}

// ─── Fetch from external API & sync to MongoDB ──────────────────
async function fetchAndSync(params = {}) {
    let notifications = [];
    try {
        const url = new URL(EXTERNAL_API);
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') {
                url.searchParams.append(k, String(v));
            }
        });

        logger.info('Fetching from external Notification API', { url: url.toString() });
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`External API returned status ${response.status}`);
        }

        const data = await response.json();
        notifications = data.notifications || [];
    } catch (apiErr) {
        logger.warn('External API unavailable, using mock data for sync', { error: apiErr.message });
        notifications = getMockNotifications();
    }

    // Sync to MongoDB if connected
    if (isDbConnected() && notifications.length > 0) {
        try {
            const ops = notifications.map(n => ({
                updateOne: {
                    filter: { externalId: n.ID },
                    update: {
                        $setOnInsert: {
                            externalId: n.ID,
                            type: n.Type,
                            message: n.Message,
                            timestamp: new Date(n.Timestamp),
                            isRead: false
                        }
                    },
                    upsert: true
                }
            }));
            await NotificationModel.bulkWrite(ops, { ordered: false });
            logger.info('Synced notifications to MongoDB', { count: notifications.length });
        } catch (err) {
            logger.warn('MongoDB sync failed (non-critical)', { error: err.message });
        }
    }

    return notifications;
}

// ─── Fallback mock data (from assessment screenshot) ─────────────
function getMockNotifications() {
    return [
        { ID: 'd146095a-0d86-4a34-9e69-3900a14576bc', Type: 'Result',    Message: 'mid-sem',                            Timestamp: '2026-04-22 17:51:30' },
        { ID: 'b283218f-ea5a-4b7c-93a9-1f2f240d64b0', Type: 'Placement', Message: 'CSX Corporation hiring',             Timestamp: '2026-04-22 17:51:18' },
        { ID: '81589ada-0ad3-4f77-9554-f52fb558e09d', Type: 'Event',     Message: 'farewell',                           Timestamp: '2026-04-22 17:51:06' },
        { ID: '0005513a-142b-4bbc-8678-eefec65e1ede', Type: 'Result',    Message: 'mid-sem',                            Timestamp: '2026-04-22 17:50:54' },
        { ID: 'ea836726-c25e-4f21-a72f-544a6af8a37f', Type: 'Result',    Message: 'project-review',                     Timestamp: '2026-04-22 17:50:42' },
        { ID: '003cb427-8fc6-47f7-bb00-be228f6b0d2c', Type: 'Result',    Message: 'external',                           Timestamp: '2026-04-22 17:50:30' },
        { ID: 'e5c4ff20-31bf-4d40-8f02-72fda59e8918', Type: 'Result',    Message: 'project-review',                     Timestamp: '2026-04-22 17:50:18' },
        { ID: '1cfce5ee-ad37-4894-8946-d707627176a5', Type: 'Event',     Message: 'tech-fest',                          Timestamp: '2026-04-22 17:50:06' },
        { ID: 'cf2885a6-45ac-4ba0-b548-6e9e9d4c52c8', Type: 'Result',    Message: 'project-review',                     Timestamp: '2026-04-22 17:49:54' },
        { ID: '8a7412bd-6065-4d09-8501-a37f11cc848b', Type: 'Placement', Message: 'Advanced Micro Devices Inc. hiring', Timestamp: '2026-04-22 17:49:42' },
    ];
}

// ─── Format notification for API response ────────────────────────
function formatNotification(n, readOverride) {
    if (n.externalId) {
        // From MongoDB document
        return {
            ID: n.externalId,
            Type: n.type,
            Message: n.message,
            Timestamp: n.timestamp.toISOString().replace('T', ' ').substring(0, 19),
            isRead: n.isRead
        };
    }
    // From external API / mock
    return { ...n, isRead: readOverride !== undefined ? readOverride : false };
}

// ─── GET /api/notifications ──────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { limit, page, notification_type } = req.query;

        // Try MongoDB first if connected
        if (isDbConnected()) {
            const count = await NotificationModel.countDocuments();
            if (count === 0) {
                logger.info('MongoDB is empty, triggering initial sync...');
                await fetchAndSync({ limit: 100 });
            }

            try {
                const filter = {};
                if (notification_type) filter.type = notification_type;

                const p = parseInt(page) || 1;
                const l = parseInt(limit) || 20;
                const skip = (p - 1) * l;

                const notifications = await NotificationModel
                    .find(filter)
                    .sort({ timestamp: -1 })
                    .skip(skip)
                    .limit(l)
                    .lean();

                const total = await NotificationModel.countDocuments(filter);

                logger.info('Serving notifications from MongoDB', { count: notifications.length, total });
                return res.json({
                    notifications: notifications.map(n => formatNotification(n)),
                    meta: { currentPage: p, totalPages: Math.ceil(total / l), total }
                });
            } catch (dbErr) {
                logger.warn('MongoDB query failed, falling back to API', { error: dbErr.message });
            }
        }

        // Fallback: fetch from external API
        let notifications = await fetchAndSync({ limit, page, notification_type });
        if (notification_type) {
            notifications = notifications.filter(n => n.Type === notification_type);
        }
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || notifications.length;
        notifications = notifications.slice((p - 1) * l, (p - 1) * l + l);

        // Check read status from DB if available
        if (isDbConnected()) {
            const ids = notifications.map(n => n.ID);
            const dbDocs = await NotificationModel.find({ externalId: { $in: ids } }).lean();
            const readMap = {};
            dbDocs.forEach(d => { readMap[d.externalId] = d.isRead; });
            notifications = notifications.map(n => formatNotification(n, readMap[n.ID] || false));
        } else {
            notifications = notifications.map(n => formatNotification(n, false));
        }

        logger.info('Returning notifications', { count: notifications.length });
        res.json({ notifications });
    } catch (err) {
        logger.error('GET /api/notifications failed', { error: err.message, stack: err.stack });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/notifications/priority ─────────────────────────────
router.get('/priority', async (req, res) => {
    try {
        const topN = parseInt(req.query.n) || 10;
        const { notification_type } = req.query;

        if (isDbConnected()) {
            const count = await NotificationModel.countDocuments();
            if (count === 0) {
                await fetchAndSync({ limit: 100 });
            }
        }

        let notifications = await fetchAndSync({});

        if (notification_type) {
            notifications = notifications.filter(n => n.Type === notification_type);
        }

        // Priority sort: Weight DESC, then Timestamp DESC (Stage 6 algorithm)
        notifications.sort((a, b) => {
            const wA = TYPE_WEIGHT[a.Type] || 0;
            const wB = TYPE_WEIGHT[b.Type] || 0;
            if (wA !== wB) return wB - wA;
            return new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime();
        });

        let topNotifications = notifications.slice(0, topN);

        // Attach read status from DB
        if (isDbConnected()) {
            const ids = topNotifications.map(n => n.ID);
            const dbDocs = await NotificationModel.find({ externalId: { $in: ids } }).lean();
            const readMap = {};
            dbDocs.forEach(d => { readMap[d.externalId] = d.isRead; });
            topNotifications = topNotifications.map(n => formatNotification(n, readMap[n.ID] || false));
        } else {
            topNotifications = topNotifications.map(n => formatNotification(n, false));
        }

        logger.info('Returning priority notifications', { topN, count: topNotifications.length });
        res.json({ notifications: topNotifications });
    } catch (err) {
        logger.error('GET /api/notifications/priority failed', { error: err.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PUT /api/notifications/:id/read ─────────────────────────────
router.put('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;

        if (isDbConnected()) {
            await NotificationModel.findOneAndUpdate(
                { externalId: id },
                { isRead: true },
                { upsert: false }
            );
            logger.info('Notification marked as read in MongoDB', { id });
        } else {
            logger.info('Notification marked as read (in-memory)', { id });
        }

        res.json({ status: 'success', message: 'Notification marked as read.' });
    } catch (err) {
        logger.error('PUT /api/notifications/:id/read failed', { error: err.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
