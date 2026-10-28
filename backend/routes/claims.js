const express = require('express');
const router = express.Router();
const storage = require('../services/storageService');

// GET /api/claims
router.get('/', async (req, res) => {
    try {
        const claims = await storage.getClaims();
        res.json({ success: true, claims });
    } catch (err) {
        console.error('[API] Error in GET /api/claims:', err);
        res.status(500).json({ success: false, error: 'Internal server error fetching claims.' });
    }
});

// POST /api/claims
router.post('/', async (req, res) => {
    try {
        const claimData = req.body;
        if (!claimData) {
            return res.status(400).json({ success: false, error: 'Missing claim data.' });
        }
        if (!claimData.claimId) {
            claimData.claimId = `CLAIM-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
        }
        if (!claimData.createdAt) {
            claimData.createdAt = new Date().toISOString();
        }

        const saved = await storage.saveClaim(claimData);
        res.status(201).json({ success: true, claim: saved });
    } catch (err) {
        console.error('[API] Error in POST /api/claims:', err);
        res.status(500).json({ success: false, error: 'Internal server error saving claim.' });
    }
});

// PATCH /api/claims/:id
router.patch('/:id', async (req, res) => {
    try {
        const { status, extraData } = req.body;
        if (!status) {
            return res.status(400).json({ success: false, error: 'Status is required.' });
        }
        const updated = await storage.updateClaimStatus(req.params.id, status, extraData);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Claim not found.' });
        }
        res.json({ success: true, claim: updated });
    } catch (err) {
        console.error('[API] Error in PATCH /api/claims/:id:', err);
        res.status(500).json({ success: false, error: 'Internal server error updating claim.' });
    }
});

module.exports = router;
