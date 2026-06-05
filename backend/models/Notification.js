/**
 * Mongoose Schema & Model for Notifications
 * Maps to the Stage 2 DB schema design from notification_system_design.md
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    externalId: {
        type: String,
        unique: true,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['Event', 'Result', 'Placement'],
        required: true
    },
    message: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        required: true,
        index: true
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true  // adds createdAt, updatedAt
});

// Compound index for the primary query pattern
notificationSchema.index({ isRead: 1, type: 1, timestamp: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
