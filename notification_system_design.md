# Stage 1

## Logging Middleware (Mandatory — Pre-Test Setup)

A custom logging middleware has been implemented in `backend/logger.js`. It is used **instead of** inbuilt language loggers or `console.log`, as required by the assessment.

**Features:**
- Structured log format: `[LEVEL] ISO_TIMESTAMP — message {metadata}`
- Logs to both `stdout` and a persistent log file (`app.log`)
- Express middleware that automatically logs every HTTP request with method, URL, status code, response time, and client IP.

**Usage in Express:**
```js
const { logger, loggingMiddleware } = require('./logger');
app.use(loggingMiddleware); // logs all HTTP requests automatically
logger.info('Custom message', { key: 'value' });
```

## Core Actions
The notification platform supports the following core actions:
- **Fetch notifications** — View all notifications with pagination and type-based filtering.
- **Fetch priority notifications** — View top N notifications ranked by weight and recency.
- **Mark as read** — Mark a single notification as read.
- **Create notification** — (Internal) Used by system services to push new notifications.

## REST API Endpoints

### GET /api/notifications
Fetch paginated, filterable list of notifications for the logged-in user.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Query Parameters:**
| Parameter           | Type    | Description                                      |
|---------------------|---------|--------------------------------------------------|
| `limit`             | integer | Number of notifications per page (default: all)  |
| `page`              | integer | Page number (default: 1)                         |
| `notification_type` | string  | Filter: `"Event"`, `"Result"`, or `"Placement"` |

**Response (200 OK):**
```json
{
  "notifications": [
    {
      "ID": "b283218f-ea5a-4b7c-93a9-1f2f240d64b0",
      "Type": "Placement",
      "Message": "CSX Corporation hiring",
      "Timestamp": "2026-04-22 17:51:18",
      "isRead": false
    }
  ]
}
```

**Error Response (500):**
```json
{ "error": "Internal server error" }
```

### GET /api/notifications/priority
Fetch top N priority-ranked notifications.

**Query Parameters:**
| Parameter           | Type    | Description                                      |
|---------------------|---------|--------------------------------------------------|
| `n`                 | integer | Number of top notifications to return (default: 10) |
| `notification_type` | string  | Optional type filter                              |

**Response (200 OK):**
```json
{
  "notifications": [
    {
      "ID": "b283218f-...",
      "Type": "Placement",
      "Message": "CSX Corporation hiring",
      "Timestamp": "2026-04-22 17:51:18",
      "isRead": false
    }
  ]
}
```

### PUT /api/notifications/{id}/read
Mark a specific notification as read.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body:** None

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Notification marked as read."
}
```

### POST /api/notifications (Internal)
Create a new notification (used by backend services, not by end-users).

**Request Body:**
```json
{
  "student_id": "23BQ1A61A5",
  "notification_type": "Placement",
  "message": "Google is hiring"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid-here",
  "status": "created"
}
```

## Mechanism for Real-Time Notifications

I propose using **WebSockets** for real-time notification delivery:

1. Upon login, the client opens a persistent WebSocket connection to the backend (`ws://localhost:5000/ws`).
2. The backend maintains a map of `student_id → WebSocket connection`.
3. When a new notification is created (e.g., HR clicks "Notify All"), the backend pushes the notification object directly through the active socket.
4. The client receives the notification instantly (sub-second latency) without HTTP polling.

**Fallback strategy:** If WebSocket connections are blocked by firewalls or proxies, the system falls back to **Server-Sent Events (SSE)**, which uses a standard HTTP connection for one-way server-to-client streaming.

---

# Stage 2

## Persistent Storage Choice

I recommend **PostgreSQL** for the following reasons:
- **ACID compliance** ensures data integrity for critical notifications (e.g., placement alerts).
- **Strong indexing** via B-Tree composite indexes allows efficient lookups on `(student_id, is_read, created_at)`.
- **ENUM types** natively map to the `notification_type` constraint.
- **UUID primary keys** enable distributed ID generation without coordination.
- **JSONB support** allows storing dynamic metadata in future without schema migrations.

## DB Schema (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

CREATE TABLE students (
    id VARCHAR(50) PRIMARY KEY,     -- e.g., '23BQ1A61A5'
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id VARCHAR(50) NOT NULL REFERENCES students(id),
    notification_type notification_type NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Composite index for the primary query pattern: fetch unread notifications for a student
CREATE INDEX idx_notifications_student_unread
ON notifications (student_id, is_read, created_at DESC);

-- Index for type-based filtering
CREATE INDEX idx_notifications_type
ON notifications (notification_type, created_at DESC);
```

## Potential Problems as Data Volume Increases
1. **Index bloat:** As the table grows past 50M+ rows, B-Tree indexes consume significant RAM and slow writes.
2. **Full table scans:** Queries without proper `WHERE` clauses on indexed columns will degrade.
3. **Write contention:** High-volume `INSERT` operations during "Notify All" events can cause lock contention.

## Solutions
1. **Table partitioning** by `created_at` (monthly range partitions) — queries only scan the relevant partition.
2. **Archival** of notifications older than 90 days to a `notifications_archive` table or cold storage.
3. **Connection pooling** (PgBouncer) to prevent exhausting DB connections under high concurrency.
4. **Read replicas** for separation of read and write workloads.

## SQL Queries for the REST APIs

```sql
-- GET /api/notifications?limit=10&page=1
SELECT id, notification_type, message, created_at, is_read
FROM notifications
WHERE student_id = '23BQ1A61A5'
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;

-- GET /api/notifications?notification_type=Placement
SELECT id, notification_type, message, created_at, is_read
FROM notifications
WHERE student_id = '23BQ1A61A5'
  AND notification_type = 'Placement'
ORDER BY created_at DESC;

-- PUT /api/notifications/{id}/read
UPDATE notifications
SET is_read = true
WHERE id = 'b283218f-ea5a-4b7c-93a9-1f2f240d64b0'
  AND student_id = '23BQ1A61A5';

-- POST /api/notifications (internal)
INSERT INTO notifications (student_id, notification_type, message)
VALUES ('23BQ1A61A5', 'Placement', 'Google is hiring');
```

---

# Stage 3

## Query Analysis

**Given query:**
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

### Is this query accurate?
It is functionally correct for fetching unread notifications, but `ORDER BY createdAt ASC` returns the **oldest** notifications first. In a notification system, users expect to see the **newest** first. This should be `DESC`.

Additionally, `SELECT *` fetches all columns including potentially large ones, which wastes bandwidth. Only select the columns needed.

### Why is this slow?
With 5,000,000 rows and no composite index on `(studentID, isRead, createdAt)`:
1. The DB performs a **full table scan** — it reads every row to check `studentID = 1042`.
2. It then filters those for `isRead = false`.
3. Finally, it sorts the filtered results by `createdAt` in memory (or on disk if the dataset is too large for the sort buffer).

**Computation cost without index:** O(N) where N = 5,000,000 rows.

### Recommended Fix
```sql
-- Create composite index covering the exact query pattern
CREATE INDEX idx_student_unread ON notifications (studentID, isRead, createdAt DESC);

-- Optimized query
SELECT id, studentID, notificationType, message, createdAt, isRead
FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

**Computation cost with index:** O(log N + K) where K = number of matching rows. The B-Tree index allows the DB to jump directly to the correct `studentID`, filter by `isRead`, and return rows already sorted — no full scan needed.

### Is adding indexes on every column effective?
**No.** This is a well-known anti-pattern:
- **Write penalty:** Every `INSERT`, `UPDATE`, and `DELETE` must also update every index. With 5M rows and frequent writes (notifications are write-heavy), this significantly degrades write performance.
- **Storage overhead:** Each index consumes disk space proportional to the table size. Indexing all columns could double or triple storage usage.
- **Maintenance overhead:** The query optimizer may choose suboptimal plans when too many indexes exist.
- **Best practice:** Only index columns and column combinations that appear in `WHERE`, `ORDER BY`, and `JOIN` clauses of frequently executed queries.

### Query: Students who got a Placement notification in the last 7 days

```sql
SELECT DISTINCT studentID
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= NOW() - INTERVAL '7 days';
```

To optimize this, add an index:
```sql
CREATE INDEX idx_type_created ON notifications (notificationType, createdAt DESC);
```

---

# Stage 4

## Problem
Notifications are fetched directly from the DB on every page load for every student. With 50,000 students, this means tens of thousands of queries per minute, overwhelming the database.

## Proposed Solutions & Tradeoffs

### 1. Caching Layer (Redis)
- **How:** Store recent notifications and unread counts per student in Redis (in-memory key-value store). On page load, the backend checks Redis first. If the data exists (cache hit), it returns instantly. If not (cache miss), it queries the DB and caches the result.
- **Cache invalidation:** When a new notification is created, invalidate or update the relevant student's cache entry.
- **Tradeoff:**
  - ✅ Reduces DB load by 90%+ for read-heavy patterns.
  - ❌ Introduces complexity: cache invalidation bugs can serve stale data.
  - ❌ Requires a separate Redis instance to manage.

### 2. Push Model (WebSockets / SSE)
- **How:** Instead of pulling data on every page load, maintain a persistent connection and push new notifications to the client in real-time.
- **Tradeoff:**
  - ✅ Zero unnecessary DB queries; data is pushed only when it exists.
  - ❌ Requires maintaining 50,000 concurrent WebSocket connections (high memory overhead).
  - ❌ Load balancing sticky sessions adds infrastructure complexity.

### 3. Delta Sync (Client-Side Caching)
- **How:** The frontend caches fetched notifications locally. On subsequent page loads, it sends the timestamp of its latest cached notification to a `GET /api/notifications/sync?since=<timestamp>` endpoint, which returns only new notifications since that timestamp.
- **Tradeoff:**
  - ✅ Minimal data transfer after the initial load.
  - ❌ Complex synchronization logic for consistency.
  - ❌ Local storage limits on the client device.

### Recommendation
Use **Redis caching** for the initial load (fast reads without DB pressure) combined with **WebSockets** for real-time delivery of new notifications. This hybrid approach eliminates polling entirely.

---

# Stage 5

## Problem Analysis

**Given pseudocode:**
```python
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)   # calls Email API
        save_to_db(student_id, message)   # DB insert
        push_to_app(student_id, message)  # real-time push
```

### Shortcomings
1. **Sequential blocking:** Processing 50,000 students one-by-one. If each iteration takes 0.5s (mostly email API latency), the total time is ~7 hours.
2. **No fault tolerance:** If `send_email` throws an error at student #200, the loop terminates. The remaining 49,800 students get nothing.
3. **Tight coupling:** The fast operations (`save_to_db`, `push_to_app`) are blocked by the slow, unreliable external operation (`send_email`).
4. **No retry mechanism:** Failed email sends are lost forever.

### Should saving to DB and sending email happen together?
**No.** They should be decoupled because:
- `save_to_db` is fast (~5ms), reliable, and under our control.
- `send_email` is slow (~500ms), unreliable (third-party API), and rate-limited.
- If they're coupled and the email fails, the DB insert is also lost. The student won't even see the notification in-app.

## Redesigned Solution

Use an **asynchronous Message Queue** (RabbitMQ, Kafka, or Redis Streams) to decouple:

```python
# 1. Producer: Publishes jobs to separate queues instantly (~50ms for all 50,000)
function notify_all(student_ids: array, message: string):
    batch = create_batch(student_ids, message)
    publish_to_queue("notification_db_queue", batch)
    publish_to_queue("notification_email_queue", batch)
    publish_to_queue("notification_push_queue", batch)
    log("Enqueued notifications for " + len(student_ids) + " students")


# 2. DB Worker: Consumes from 'notification_db_queue' (fast, high concurrency)
function db_worker(task):
    try:
        save_to_db(task.student_id, task.message)
    except Error as e:
        log_error("DB save failed", task.student_id, e)
        retry_with_backoff(task, max_retries=3)


# 3. Email Worker: Consumes from 'notification_email_queue' (throttled)
function email_worker(task):
    try:
        send_email(task.student_id, task.message)
    except Error as e:
        log_error("Email failed", task.student_id, e)
        # Exponential backoff: retry after 5s, 25s, 125s
        retry_with_backoff(task, max_retries=5, base_delay=5)


# 4. Push Worker: Consumes from 'notification_push_queue'
function push_worker(task):
    try:
        push_to_app(task.student_id, task.message)
    except Error as e:
        log_error("Push failed", task.student_id, e)
        # Push failures are non-critical; log and move on
```

### Key Design Decisions
- **Separate queues per channel:** Email failure doesn't block DB saves or in-app pushes.
- **Exponential backoff retry:** Failed emails are retried with increasing delays (5s → 25s → 125s) up to a maximum.
- **Dead letter queue (DLQ):** After max retries, failed messages are moved to a DLQ for manual review instead of being lost.
- **Batch publishing:** The producer enqueues all 50,000 messages in a single batch operation, completing in milliseconds.
- **Horizontal scaling:** Multiple email workers can run in parallel, throttled by rate limits.

---

# Stage 6

## Approach: Priority Inbox

**Goal:** Maintain the top `n` most important unread notifications efficiently, even as new notifications keep streaming in.

### Priority Scoring
Each notification's priority is determined by a **tuple: (Weight, Timestamp)**:
| Type       | Weight |
|------------|--------|
| Placement  | 3      |
| Result     | 2      |
| Event      | 1      |

Higher weight = higher priority. For equal weights, the **newer** notification (later timestamp) takes priority.

### Algorithm: Min-Heap of size N
Instead of sorting the entire array every time (O(m log m) where m = total notifications), we use a **Min-Heap** data structure of fixed size `n`:

1. As each notification arrives, compute its priority `(weight, timestamp)`.
2. If the heap has fewer than `n` elements, push the notification in.
3. If the heap is full, compare the incoming notification with the heap's minimum:
   - If the new notification has higher priority → pop the minimum, push the new one.
   - Otherwise → discard it.
4. **Time complexity:** O(log n) per incoming notification. Since n = 10, this is effectively O(1).
5. **Space complexity:** O(n) — only 10 notifications are held in memory at any time.

### How to maintain top 10 efficiently with streaming data
When new notifications keep arriving (e.g., via WebSocket or periodic polling):
- The Min-Heap is updated in constant time per notification.
- No need to re-sort the entire dataset.
- The heap can be persisted in Redis for cross-session consistency.

### Implementation
The functioning code is located at:
- **Backend:** `backend/routes.js` — the `GET /api/notifications/priority` endpoint implements the sorting and top-N logic.
- **Standalone script:** `Stage6/priority_inbox.js` — a standalone Node.js script demonstrating the Min-Heap approach.

Both use the provided Notification API (`http://4.224.186.213/evaluation-service/notifications`) to fetch data, with a fallback to mock data if the API is unavailable.
