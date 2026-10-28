const express = require('express');
const router = express.Router();
const storage = require('../services/storageService');

// GET /api/notifications
router.get('/', async (req, res) => {
    try {
        const email = req.query.email?.trim();
        const notifs = await storage.getNotifications(email);
        res.json({ success: true, notifications: notifs });
    } catch (err) {
        console.error('[API] Error in GET /api/notifications:', err);
        res.status(500).json({ success: false, error: 'Internal server error fetching notifications.' });
    }
});

// POST /api/notifications
router.post('/', async (req, res) => {
    try {
        const notif = req.body;
        if (!notif || !notif.recipientEmail) {
            return res.status(400).json({ success: false, error: 'Recipient email is required.' });
        }
        if (!notif.id) {
            notif.id = `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
        }
        if (!notif.timestamp) {
            notif.timestamp = new Date().toISOString();
        }

        const saved = await storage.sendNotification(notif);
        res.status(201).json({ success: true, notification: saved });
    } catch (err) {
        console.error('[API] Error in POST /api/notifications:', err);
        res.status(500).json({ success: false, error: 'Internal server error saving notification.' });
    }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
    try {
        const updated = await storage.markNotificationAsRead(req.params.id);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Notification not found.' });
        }
        res.json({ success: true, notification: updated });
    } catch (err) {
        console.error('[API] Error in PATCH /api/notifications/:id/read:', err);
        res.status(500).json({ success: false, error: 'Internal server error updating notification.' });
    }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await storage.deleteNotification(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Notification not found or already deleted.' });
        }
        res.json({ success: true, message: 'Notification deleted.' });
    } catch (err) {
        console.error('[API] Error in DELETE /api/notifications/:id:', err);
        res.status(500).json({ success: false, error: 'Internal server error deleting notification.' });
    }
});

// DELETE /api/notifications (clear all for a user)
router.delete('/', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email query parameter is required to clear notifications.' });
        }
        await storage.clearNotifications(email);
        res.json({ success: true, message: 'All notifications cleared for user.' });
    } catch (err) {
        console.error('[API] Error in DELETE /api/notifications:', err);
        res.status(500).json({ success: false, error: 'Internal server error clearing notifications.' });
    }
});

module.exports = router;
