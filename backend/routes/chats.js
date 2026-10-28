const express = require('express');
const router = express.Router();
const storage = require('../services/storageService');

// GET /api/chats
router.get('/', async (req, res) => {
    try {
        const { lostItemId, foundItemId, userEmail } = req.query;
        let chats = await storage.getChats();

        if (lostItemId && foundItemId) {
            const pair = await storage.getChatByPair(lostItemId, foundItemId);
            return res.json({ success: true, chat: pair });
        }

        if (userEmail) {
            const target = userEmail.toLowerCase().trim();
            chats = chats.filter(c =>
                (c.lostUserEmail && c.lostUserEmail.toLowerCase().trim() === target) ||
                (c.finderEmail && c.finderEmail.toLowerCase().trim() === target)
            );
        }

        res.json({ success: true, chats });
    } catch (err) {
        console.error('[API] Error in GET /api/chats:', err);
        res.status(500).json({ success: false, error: 'Internal server error fetching chats.' });
    }
});

// GET /api/chats/:id
router.get('/:id', async (req, res) => {
    try {
        const chat = await storage.getChatById(req.params.id);
        if (!chat) {
            return res.status(404).json({ success: false, error: 'Chat not found.' });
        }
        res.json({ success: true, chat });
    } catch (err) {
        console.error('[API] Error in GET /api/chats/:id:', err);
        res.status(500).json({ success: false, error: 'Internal server error fetching chat.' });
    }
});

// POST /api/chats
router.post('/', async (req, res) => {
    try {
        const chatData = req.body;
        if (!chatData || !chatData.chatId) {
            return res.status(400).json({ success: false, error: 'Chat data with chatId is required.' });
        }
        const saved = await storage.saveChat(chatData);
        res.status(201).json({ success: true, chat: saved });
    } catch (err) {
        console.error('[API] Error in POST /api/chats:', err);
        res.status(500).json({ success: false, error: 'Internal server error saving chat.' });
    }
});

// POST /api/chats/:id/messages
router.post('/:id/messages', async (req, res) => {
    try {
        const message = req.body;
        if (!message || !message.text) {
            return res.status(400).json({ success: false, error: 'Message content is required.' });
        }
        if (!message.id) {
            message.id = `MSG-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
        }
        if (!message.timestamp) {
            message.timestamp = new Date().toISOString();
        }

        const updated = await storage.sendChatMessage(req.params.id, message);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Chat not found.' });
        }
        res.status(201).json({ success: true, chat: updated, message });
    } catch (err) {
        console.error('[API] Error in POST /api/chats/:id/messages:', err);
        res.status(500).json({ success: false, error: 'Internal server error sending message.' });
    }
});

// PATCH /api/chats/:id/status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status, recoveryDetails } = req.body;
        if (!status) {
            return res.status(400).json({ success: false, error: 'Status is required.' });
        }
        const updated = await storage.updateChatStatus(req.params.id, status, recoveryDetails);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Chat not found.' });
        }
        res.json({ success: true, chat: updated });
    } catch (err) {
        console.error('[API] Error in PATCH /api/chats/:id/status:', err);
        res.status(500).json({ success: false, error: 'Internal server error updating chat status.' });
    }
});

// POST /api/chats/:id/read
router.post('/:id/read', async (req, res) => {
    try {
        const { userEmail } = req.body;
        if (!userEmail) {
            return res.status(400).json({ success: false, error: 'userEmail is required.' });
        }
        const updated = await storage.markChatMessagesRead(req.params.id, userEmail);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Chat not found.' });
        }
        res.json({ success: true, message: 'Messages marked as read.' });
    } catch (err) {
        console.error('[API] Error in POST /api/chats/:id/read:', err);
        res.status(500).json({ success: false, error: 'Internal server error marking messages read.' });
    }
});

module.exports = router;
