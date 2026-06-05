const logger = require('../logger');

// Weight mappings for priority calculation
const TYPE_WEIGHT = {
    'Placement': 3,
    'Result': 2,
    'Event': 1
};

/**
 * Calculates priority score. Higher weight is better.
 * For equal weight, newer timestamp is better.
 * We'll use a tuple-like comparison: [weight, timestamp]
 */
function comparePriority(a, b) {
    const weightA = TYPE_WEIGHT[a.Type] || 0;
    const weightB = TYPE_WEIGHT[b.Type] || 0;
    
    if (weightA !== weightB) {
        return weightA - weightB; // Ascending order of weight
    }
    
    // If weights are equal, compare timestamps (newer is higher priority)
    const timeA = new Date(a.Timestamp).getTime();
    const timeB = new Date(b.Timestamp).getTime();
    return timeA - timeB; // Ascending order of time
}

/**
 * A simple Min-Heap to maintain the top N notifications.
 */
class MinHeap {
    constructor(capacity, compareFn) {
        this.capacity = capacity;
        this.compareFn = compareFn;
        this.heap = [];
    }

    push(val) {
        if (this.heap.length < this.capacity) {
            this.heap.push(val);
            this.heap.sort(this.compareFn);
        } else {
            // Compare new value with the minimum (which is at index 0 because it's sorted)
            if (this.compareFn(val, this.heap[0]) > 0) {
                this.heap[0] = val;
                this.heap.sort(this.compareFn);
            }
        }
    }

    getTopN() {
        // Return sorted descending (highest priority first)
        return [...this.heap].sort((a, b) => this.compareFn(b, a));
    }
}

async function fetchNotifications() {
    // API URL provided in the prompt
    const apiUrl = 'http://4.224.186.213/evaluation-service/notifications';
    try {
        logger.info(`Fetching notifications from ${apiUrl}`);
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
        }
        const data = await response.json();
        return data.notifications || [];
    } catch (error) {
        logger.warn('Failed to fetch from API, using fallback mock data.', { error: error.message });
        // Fallback Mock Data
        return [
            { "ID": "d14...", "Type": "Result", "Message": "mid-sem", "Timestamp": "2026-04-22 17:51:30" },
            { "ID": "b28...", "Type": "Placement", "Message": "CSX Corporation hiring", "Timestamp": "2026-04-22 17:51:18" },
            { "ID": "815...", "Type": "Event", "Message": "farewell", "Timestamp": "2026-04-22 17:51:06" },
            { "ID": "000...", "Type": "Result", "Message": "mid-sem", "Timestamp": "2026-04-22 17:50:54" },
            { "ID": "ea8...", "Type": "Result", "Message": "project-review", "Timestamp": "2026-04-22 17:50:42" },
            { "ID": "003...", "Type": "Result", "Message": "external", "Timestamp": "2026-04-22 17:50:30" },
            { "ID": "e5c...", "Type": "Result", "Message": "project-review", "Timestamp": "2026-04-22 17:50:18" },
            { "ID": "1cf...", "Type": "Event", "Message": "tech-fest", "Timestamp": "2026-04-22 17:50:06" },
            { "ID": "cf2...", "Type": "Result", "Message": "project-review", "Timestamp": "2026-04-22 17:49:54" },
            { "ID": "8a7...", "Type": "Placement", "Message": "Advanced Micro Devices Inc. hiring", "Timestamp": "2026-04-22 17:49:42" }
        ];
    }
}

async function runPriorityInbox(n = 10) {
    const notifications = await fetchNotifications();
    const minHeap = new MinHeap(n, comparePriority);

    logger.info(`Processing ${notifications.length} notifications to find Top ${n}`);
    
    // Simulate streaming new notifications
    for (const notif of notifications) {
        minHeap.push(notif);
    }

    const topN = minHeap.getTopN();
    
    logger.info('--- TOP N PRIORITY INBOX ---');
    topN.forEach((notif, index) => {
        logger.info(`Rank ${index + 1}: [${notif.Type}] ${notif.Message} (${notif.Timestamp})`);
    });
}

// Execute if run directly
if (require.main === module) {
    runPriorityInbox(10);
}

module.exports = { runPriorityInbox, MinHeap };
