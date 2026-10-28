const express = require('express');
const router = express.Router();
const storage = require('../services/storageService');
const { validateReportForm } = require('../services/validationService');

// GET /api/reports
router.get('/', async (req, res) => {
    try {
        const { type, category, zone, status, search, email } = req.query;
        let reports = await storage.getReports();

        if (type) {
            reports = reports.filter(r => r && r.type === type);
        }
        if (category && category !== 'all') {
            reports = reports.filter(r => r && r.category && r.category.toLowerCase() === category.toLowerCase());
        }
        if (zone && zone !== 'all') {
            reports = reports.filter(r => r && r.zone && r.zone.toLowerCase() === zone.toLowerCase());
        }
        if (status && status !== 'all') {
            reports = reports.filter(r => r && r.status && r.status.toLowerCase() === status.toLowerCase());
        }
        if (email) {
            const target = email.toLowerCase().trim();
            reports = reports.filter(r => r && r.postedByEmail && r.postedByEmail.toLowerCase().trim() === target);
        }
        if (search) {
            const q = search.toLowerCase().trim();
            reports = reports.filter(r => {
                if (!r) return false;
                return (r.itemName && r.itemName.toLowerCase().includes(q)) ||
                       (r.description && r.description.toLowerCase().includes(q)) ||
                       (r.category && r.category.toLowerCase().includes(q)) ||
                       (r.zone && r.zone.toLowerCase().includes(q)) ||
                       (r.color && r.color.toLowerCase().includes(q));
            });
        }

        res.json({ success: true, reports });
    } catch (err) {
        console.error('[API] Error in GET /api/reports:', err);
        res.status(500).json({ success: false, error: 'Internal server error fetching reports.' });
    }
});

// GET /api/reports/:id
router.get('/:id', async (req, res) => {
    try {
        const report = await storage.getReportById(req.params.id);
        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found.' });
        }
        res.json({ success: true, report });
    } catch (err) {
        console.error('[API] Error in GET /api/reports/:id:', err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// POST /api/reports
router.post('/', async (req, res) => {
    try {
        const reportData = req.body;
        if (!reportData) {
            return res.status(400).json({ success: false, error: 'Missing report data.' });
        }

        const validation = validateReportForm(reportData);
        if (!validation.isValid) {
            return res.status(400).json({ success: false, errors: validation.errors });
        }

        if (!reportData.id) {
            const prefix = (reportData.type || 'item').toUpperCase().slice(0, 4);
            reportData.id = `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
        }
        if (!reportData.createdAt) {
            reportData.createdAt = new Date().toISOString();
        }
        if (!reportData.status) {
            reportData.status = 'Open';
        }

        const saved = await storage.saveReport(reportData);
        res.status(201).json({ success: true, report: saved });
    } catch (err) {
        console.error('[API] Error in POST /api/reports:', err);
        res.status(500).json({ success: false, error: 'Internal server error saving report.' });
    }
});

// DELETE /api/reports/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await storage.deleteReport(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Report not found or already deleted.' });
        }
        res.json({ success: true, message: 'Report and related records deleted successfully.' });
    } catch (err) {
        console.error('[API] Error in DELETE /api/reports/:id:', err);
        res.status(500).json({ success: false, error: 'Internal server error deleting report.' });
    }
});

module.exports = router;
