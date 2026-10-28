const express = require('express');
const router = express.Router();
const storage = require('../services/storageService');
const { validateUserRegistration } = require('../services/validationService');

const ADMIN_EMAILS = [
    "kartikey3214.beai24@chitkara.edu.in"
];

function isAdminEmail(email) {
    if (!email) return false;
    const target = email.toLowerCase().trim();
    return ADMIN_EMAILS.some(e => e.toLowerCase().trim() === target);
}

// GET /api/users
router.get('/', async (req, res) => {
    try {
        const users = await storage.getUsers();
        const sanitized = users.map(u => ({
            username: u.username,
            useremail: u.useremail,
            contactPhone: u.contactPhone,
            studentId: u.studentId,
            department: u.department,
            banned: !!u.banned,
            isAdmin: isAdminEmail(u.useremail)
        }));
        res.json({ success: true, users: sanitized });
    } catch (err) {
        console.error('[API] Error in GET /api/users:', err);
        res.status(500).json({ success: false, error: 'Internal server error fetching users.' });
    }
});

// POST /api/users/signup
router.post('/signup', async (req, res) => {
    try {
        const userData = req.body;
        if (!userData) {
            return res.status(400).json({ success: false, error: 'Missing registration data.' });
        }

        const validation = validateUserRegistration(userData);
        if (!validation.isValid) {
            return res.status(400).json({ success: false, errors: validation.errors });
        }

        const existingEmail = await storage.findUserByEmail(userData.useremail);
        if (existingEmail) {
            return res.status(409).json({ success: false, error: `An account with email ${userData.useremail} already exists.` });
        }

        const existingStudent = await storage.findUserByStudentId(userData.studentId);
        if (existingStudent) {
            return res.status(409).json({ success: false, error: `Student ID ${userData.studentId} is already registered.` });
        }

        const user = {
            username: userData.username.trim(),
            useremail: userData.useremail.toLowerCase().trim(),
            userpassword: userData.userpassword,
            contactPhone: userData.contactPhone.trim(),
            studentId: userData.studentId.trim(),
            department: userData.department,
            banned: false,
            createdAt: new Date().toISOString()
        };

        const saved = await storage.saveUser(user);
        res.status(201).json({
            success: true,
            user: {
                username: saved.username,
                useremail: saved.useremail,
                contactPhone: saved.contactPhone,
                studentId: saved.studentId,
                department: saved.department,
                isAdmin: isAdminEmail(saved.useremail)
            }
        });
    } catch (err) {
        console.error('[API] Error in POST /api/users/signup:', err);
        res.status(500).json({ success: false, error: 'Internal server error during signup.' });
    }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
    try {
        const { email, password, studentId, department } = req.body;
        if (!email || !password || !studentId || !department) {
            return res.status(400).json({ success: false, error: 'Please fill in all required fields.' });
        }

        const user = await storage.findUserByEmail(email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'No account found for that email.' });
        }

        if (user.userpassword !== password) {
            return res.status(401).json({ success: false, error: 'Incorrect password.' });
        }

        if (user.banned) {
            return res.status(403).json({ success: false, error: 'This account has been suspended. Contact an administrator.' });
        }

        if (user.studentId && user.studentId.toLowerCase().trim() !== studentId.toLowerCase().trim()) {
            return res.status(401).json({ success: false, error: 'Incorrect Student ID.' });
        }

        if (user.department && user.department !== department) {
            return res.status(401).json({ success: false, error: `Incorrect Department for ${user.username}.` });
        }

        res.json({
            success: true,
            user: {
                username: user.username,
                useremail: user.useremail,
                contactPhone: user.contactPhone,
                studentId: user.studentId,
                department: user.department,
                isAdmin: isAdminEmail(user.useremail)
            }
        });
    } catch (err) {
        console.error('[API] Error in POST /api/users/login:', err);
        res.status(500).json({ success: false, error: 'Internal server error during login.' });
    }
});

// POST /api/users/save (Idempotent user sync/save)
router.post('/save', async (req, res) => {
    try {
        const user = req.body;
        if (!user || !user.useremail) {
            return res.status(400).json({ success: false, error: 'User object with useremail is required.' });
        }
        const saved = await storage.saveUser(user);
        res.json({ success: true, user: saved });
    } catch (err) {
        console.error('[API] Error in POST /api/users/save:', err);
        res.status(500).json({ success: false, error: 'Internal server error saving user.' });
    }
});

// POST /api/users/ban
router.post('/ban', async (req, res) => {
    try {
        const { email, banned } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required.' });
        }
        const updated = await storage.setUserBanned(email, banned);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        res.json({ success: true, email, banned: !!banned });
    } catch (err) {
        console.error('[API] Error in POST /api/users/ban:', err);
        res.status(500).json({ success: false, error: 'Internal server error updating user status.' });
    }
});

// DELETE /api/users/:email
router.delete('/:email', async (req, res) => {
    try {
        const deleted = await storage.deleteUser(req.params.email);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'User not found or already deleted.' });
        }
        res.json({ success: true, message: 'User deleted successfully.' });
    } catch (err) {
        console.error('[API] Error in DELETE /api/users/:email:', err);
        res.status(500).json({ success: false, error: 'Internal server error deleting user.' });
    }
});

module.exports = router;
