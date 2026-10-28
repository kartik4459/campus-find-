const express = require('express');
const router = express.Router();
const storage = require('../services/storageService');
const { calculateMatchScore, findMatches } = require('../services/matchingService');

// POST /api/matching/score
router.post('/score', (req, res) => {
    try {
        const { targetItem, candidateItem } = req.body;
        if (!targetItem || !candidateItem) {
            return res.status(400).json({ success: false, error: 'Both targetItem and candidateItem are required.' });
        }
        const scoreResult = calculateMatchScore(targetItem, candidateItem);
        res.json({ success: true, match: scoreResult });
    } catch (err) {
        console.error('[API] Error in POST /api/matching/score:', err);
        res.status(500).json({ success: false, error: 'Internal server error calculating match score.' });
    }
});

// POST /api/matching/find-matches
router.post('/find-matches', async (req, res) => {
    try {
        const { targetItem, targetItemId, reports: providedReports } = req.body;

        let item = targetItem;
        if (!item && targetItemId) {
            item = await storage.getReportById(targetItemId);
        }

        if (!item) {
            return res.status(400).json({ success: false, error: 'Valid targetItem or targetItemId is required.' });
        }

        const candidatePool = Array.isArray(providedReports) ? providedReports : await storage.getReports();
        const matches = findMatches(item, candidatePool);

        res.json({
            success: true,
            targetItem: item,
            matchesCount: matches.length,
            matches
        });
    } catch (err) {
        console.error('[API] Error in POST /api/matching/find-matches:', err);
        res.status(500).json({ success: false, error: 'Internal server error finding matches.' });
    }
});

module.exports = router;
