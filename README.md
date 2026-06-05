# Affordmed Full Stack Assessment — Notification System

This repository contains the complete Full Stack implementation for the Affordmed Notification System assessment (Roll No: **23BQ1A61A5**). 

The project includes a robust **Node.js/Express Backend** with MongoDB persistence and a **React/Vite Frontend** using Material UI (MUI).

## 🌟 Key Features
- **Priority Inbox Algorithm:** Uses a Min-Heap approach to efficiently manage and display the top 10 most important notifications (Placement > Result > Event).
- **Persistent Storage:** MongoDB integration with compound indexes for rapid unread notification retrieval.
- **Custom Logging Middleware:** Complete implementation of the mandatory Pre-Test Setup logging requirements (no inbuilt `console.log` used for server logs).
- **Graceful Fallbacks:** The backend gracefully falls back to mock data if the external Affordmed API is down, automatically syncing to MongoDB.
- **Modern UI/UX:** A glassmorphism dark-theme interface with real-time "Mark as Read" functionality and unread badge counters.

---

## 🛠️ Prerequisites
To run this project on any computer, ensure you have the following installed:
1. **Node.js** (v18 or higher) — [Download here](https://nodejs.org/)
2. **MongoDB Community Server** (Running locally on port `27017`) — [Download here](https://www.mongodb.com/try/download/community)
3. **Git** — [Download here](https://git-scm.com/)

---

## 🚀 Installation & Setup

Clone the repository to your local machine:
```bash
git clone https://github.com/harsha996612/23BQ1A61A5.git
cd 23BQ1A61A5
```

### 1. Backend Setup
Open a terminal and navigate to the backend directory:
```bash
cd backend
npm install
```
Start the backend server:
```bash
npm start
```
*The backend will run on `http://localhost:5000` and automatically connect to your local MongoDB instance.*

### 2. Frontend Setup
Open a **new** terminal and navigate to the frontend directory:
```bash
cd frontend
npm install
```
Start the frontend Vite development server:
```bash
npm run dev
```
*The frontend will run on `http://localhost:3000`.*

---

## 📖 How to Use the App
1. Open your browser and go to **`http://localhost:3000`**.
2. **All Notifications Tab:** View all notifications fetched from the database, paginated.
3. **Priority Inbox Tab:** View the Top 10 priority notifications sorted by Weight (`Placement: 3`, `Result: 2`, `Event: 1`) and Recency.
4. **Mark as Read:** Click the double-tick icon next to any unread notification. The UI will instantly update, and the read status will be persisted in MongoDB.

---

## 🗂️ Project Structure
```text
📦 23BQ1A61A5
 ┣ 📂 backend                 # Express.js REST API Server
 ┃ ┣ 📂 models                # MongoDB Mongoose Schemas
 ┃ ┣ 📜 db.js                 # Database connection logic
 ┃ ┣ 📜 logger.js             # Custom mandatory logging middleware
 ┃ ┣ 📜 routes.js             # API Endpoints (/, /priority, /:id/read)
 ┃ ┗ 📜 server.js             # Express entry point
 ┣ 📂 frontend                # React + Vite Client
 ┃ ┣ 📂 src
 ┃ ┃ ┣ 📜 App.tsx             # Main UI Dashboard
 ┃ ┃ ┣ 📜 api.ts              # API calls to backend
 ┃ ┃ ┗ 📜 main.tsx            # React DOM entry
 ┃ ┗ 📜 vite.config.ts
 ┣ 📂 Stage6                  # Standalone algorithm demonstration
 ┃ ┗ 📜 priority_inbox.js
 ┗ 📜 notification_system_design.md  # Detailed System Architecture (Stages 1-6)
```

## 🌐 API Endpoints (Backend)
- `GET /api/notifications?page=1&limit=20` — Fetch all notifications
- `GET /api/notifications/priority?n=10` — Fetch top priority notifications
- `PUT /api/notifications/:id/read` — Mark a notification as read
