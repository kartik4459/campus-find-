require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { connectDB } = require('./backend/config/db');
const storage = require('./backend/services/storageService');
const reportsRouter = require('./backend/routes/reports');
const usersRouter = require('./backend/routes/users');
const claimsRouter = require('./backend/routes/claims');
const chatsRouter = require('./backend/routes/chats');
const notificationsRouter = require('./backend/routes/notifications');
const matchingRouter = require('./backend/routes/matching');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all incoming requests (e.g. VS Code Live Server on port 5501)
app.use(cors());

// Parse JSON request bodies with support for base64 images
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health check endpoint (includes database connection status)
app.get('/api/health', (req, res) => {
    const { getIsConnected } = require('./backend/config/db');
    res.json({
        status: 'ok',
        service: 'CampusFind Backend API',
        database: getIsConnected() ? 'MongoDB Atlas (Connected)' : 'Local Storage Mode',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Full state sync endpoint (helps frontend sync existing data without database complexity)
app.get('/api/sync', async (req, res) => {
    try {
        const data = await storage.getAllData();
        res.json({ success: true, ...data });
    } catch (err) {
        console.error('[Server] Sync error:', err);
        res.status(500).json({ success: false, error: 'Failed to retrieve sync data.' });
    }
});

// Bulk sync endpoint for frontend to push localStorage data to MongoDB / backend
app.post('/api/sync', async (req, res) => {
    try {
        const { users, reports, claims, chats, notifications } = req.body || {};

        if (Array.isArray(users)) {
            for (const u of users) await storage.saveUser(u);
        }
        if (Array.isArray(reports)) {
            for (const r of reports) await storage.saveReport(r);
        }
        if (Array.isArray(claims)) {
            for (const c of claims) await storage.saveClaim(c);
        }
        if (Array.isArray(chats)) {
            for (const c of chats) await storage.saveChat(c);
        }
        if (Array.isArray(notifications)) {
            for (const n of notifications) await storage.sendNotification(n);
        }

        res.json({ success: true, message: 'Sync complete' });
    } catch (err) {
        console.error('[Server] Bulk sync error:', err);
        res.status(500).json({ success: false, error: 'Failed to apply sync data.' });
    }
});

// Mount modular API routers
app.use('/api/reports', reportsRouter);
app.use('/api/users', usersRouter);
app.use('/api/auth', usersRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/matching', matchingRouter);

// Serve static frontend assets directly
app.use(express.static(__dirname));

// Fallback route for root: serves index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Generic 404 for unmatched API routes
app.all('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: `API route ${req.method} ${req.originalUrl} not found.` });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[Server Error]', err);
    res.status(500).json({
        success: false,
        error: 'An unexpected internal error occurred on the server.'
    });
});

if (require.main === module) {
    connectDB().then(() => {
        app.listen(PORT, () => {
            console.log(`[CampusFind Server] Running on http://localhost:${PORT}`);
        });
    });
}

module.exports = app;
