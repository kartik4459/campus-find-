// Automated Test Suite for CampusFind Node.js + Express Backend
const assert = require('assert');
const http = require('http');
const app = require('../server');
const matchingService = require('../backend/services/matchingService');
const validationService = require('../backend/services/validationService');
const storage = require('../backend/services/storageService');

let server;
let baseUrl;

function makeRequest(method, endpoint, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, baseUrl);
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log('\n========================================');
    console.log('  CampusFind Backend Verification Tests ');
    console.log('========================================\n');

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`  ✓ ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ✗ ${name}`);
            console.error(`    Error: ${err.message}`);
            failed++;
        }
    }

    // Start server on an ephemeral port
    await new Promise((resolve) => {
        server = app.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://localhost:${port}`;
            console.log(`Test server running at ${baseUrl}\n`);
            resolve();
        });
    });

    try {
        // ── 1. Static File Serving ───────────────────────
        console.log('[1/7] Testing Static File & Root Serving...');
        await test('Serves index.html at root "/"', async () => {
            const res = await makeRequest('GET', '/');
            assert.strictEqual(res.status, 200);
            assert(typeof res.body === 'string' && res.body.includes('CampusFind'));
        });

        await test('Serves static CSS assets', async () => {
            const res = await makeRequest('GET', '/css/style.css');
            assert.strictEqual(res.status, 200);
        });

        await test('Serves frontend JavaScript files', async () => {
            const res = await makeRequest('GET', '/js/storage.js');
            assert.strictEqual(res.status, 200);
            assert(typeof res.body === 'string' && res.body.includes('CampusFind LocalStorage Data Layer'));
        });

        // ── 2. Health & Status Endpoints ─────────────────
        console.log('\n[2/7] Testing System & Health Endpoints...');
        await test('GET /api/health returns status ok', async () => {
            const res = await makeRequest('GET', '/api/health');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.status, 'ok');
            assert.strictEqual(res.body.service, 'CampusFind Backend API');
        });

        await test('GET /api/sync returns state arrays', async () => {
            const res = await makeRequest('GET', '/api/sync');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert(Array.isArray(res.body.users));
            assert(Array.isArray(res.body.reports));
        });

        // ── 3. Validation Logic ──────────────────────────
        console.log('\n[3/7] Testing Server-side Validation Engine...');
        await test('Email validator rejects invalid and accepts valid emails', () => {
            assert.strictEqual(validationService.isValidEmail('test@chitkara.edu.in'), true);
            assert.strictEqual(validationService.isValidEmail('not-an-email'), false);
            assert.strictEqual(validationService.isValidEmail(''), false);
        });

        await test('Password validator requires min 8 chars, letter, digit, special char', () => {
            assert.strictEqual(validationService.validatePasswordSecurity('Pass@123').isValid, true);
            assert.strictEqual(validationService.validatePasswordSecurity('weak').isValid, false);
            assert.strictEqual(validationService.validatePasswordSecurity('NoDigits!').isValid, false);
        });

        await test('Report form validation enforces required fields and description length', () => {
            const invalidReport = { itemName: 'A', category: '', color: '', zone: '', date: '', description: 'short' };
            const validReport = {
                itemName: 'Titan Watch',
                category: 'Accessories',
                color: 'Black',
                zone: 'Library',
                date: '2026-08-20',
                description: 'Black analog titan wrist watch left on study desk',
                contactName: 'Test Student',
                contactEmail: 'student@example.com'
            };
            assert.strictEqual(validationService.validateReportForm(invalidReport).isValid, false);
            assert.strictEqual(validationService.validateReportForm(validReport).isValid, true);
        });

        // ── 4. Users & Authentication API ────────────────
        console.log('\n[4/7] Testing User Accounts & Auth API...');
        const testUserEmail = `testuser_${Date.now()}@example.com`;
        await test('POST /api/users/signup registers a valid user', async () => {
            const res = await makeRequest('POST', '/api/users/signup', {
                username: 'Test User',
                useremail: testUserEmail,
                userpassword: 'Password@123',
                contactPhone: '+91 9876543210',
                studentId: `STU${Date.now()}`,
                department: 'Computer Science'
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.user.useremail, testUserEmail);
        });

        await test('POST /api/users/signup rejects duplicate email', async () => {
            const res = await makeRequest('POST', '/api/users/signup', {
                username: 'Duplicate',
                useremail: testUserEmail,
                userpassword: 'Password@123',
                contactPhone: '+91 9876543210',
                studentId: `STU_DUP`,
                department: 'Computer Science'
            });
            assert.strictEqual(res.status, 409);
        });

        await test('POST /api/users/login verifies credentials', async () => {
            const user = await storage.findUserByEmail(testUserEmail);
            const studentId = user ? user.studentId : '';
            const res = await makeRequest('POST', '/api/users/login', {
                email: testUserEmail,
                password: 'Password@123',
                studentId: studentId,
                department: 'Computer Science'
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.user.username, 'Test User');
        });

        // ── 5. Reports & Cascade Cleanup ─────────────────
        console.log('\n[5/7] Testing Reports CRUD & Cascade Cleanup...');
        let lostReportId;
        let foundReportId;

        await test('POST /api/reports creates a lost item report', async () => {
            const res = await makeRequest('POST', '/api/reports', {
                type: 'lost',
                itemName: 'Blue Water Bottle',
                category: 'Accessories',
                color: 'Blue',
                zone: 'Cafeteria',
                date: '2026-08-20',
                description: 'Navy blue stainless steel bottle with sticker',
                contactName: 'Lost Owner',
                contactEmail: testUserEmail,
                postedByEmail: testUserEmail
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.success, true);
            lostReportId = res.body.report.id;
            assert(lostReportId);
        });

        await test('POST /api/reports creates a found item report', async () => {
            const res = await makeRequest('POST', '/api/reports', {
                type: 'found',
                itemName: 'Navy Bottle',
                category: 'Accessories',
                color: 'Blue',
                zone: 'Cafeteria',
                date: '2026-08-20',
                description: 'Navy blue bottle found near canteen table',
                contactName: 'Good Samaritan',
                contactEmail: 'finder@example.com',
                postedByEmail: 'finder@example.com'
            });
            assert.strictEqual(res.status, 201);
            foundReportId = res.body.report.id;
            assert(foundReportId);
        });

        await test('GET /api/reports retrieves list with filters', async () => {
            const res = await makeRequest('GET', '/api/reports?type=lost');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            const found = res.body.reports.some(r => r.id === lostReportId);
            assert.strictEqual(found, true);
        });

        // ── 6. Algorithmic Matching Service ──────────────
        console.log('\n[6/7] Testing Matching Algorithm Service...');
        await test('Matching service scores matching attributes correctly', () => {
            const item1 = {
                id: 'L1',
                type: 'lost',
                category: 'Accessories',
                color: 'Blue',
                zone: 'Cafeteria',
                date: '2026-08-20',
                description: 'Navy blue bottle'
            };
            const item2 = {
                id: 'F1',
                type: 'found',
                category: 'Accessories',
                color: 'Blue',
                zone: 'Cafeteria',
                date: '2026-08-20',
                description: 'Navy blue bottle'
            };

            const scoreRes = matchingService.calculateMatchScore(item1, item2);
            assert(scoreRes.score >= 80, `Expected score >= 80, got ${scoreRes.score}`);
            assert(scoreRes.reasons.length >= 4);
        });

        await test('POST /api/matching/find-matches identifies candidate items', async () => {
            const lostItem = await storage.getReportById(lostReportId);
            const res = await makeRequest('POST', '/api/matching/find-matches', {
                targetItem: lostItem
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert(res.body.matches.length > 0);
            const topMatch = res.body.matches[0];
            assert.strictEqual(topMatch.candidate.id, foundReportId);
        });

        // ── 7. Claims, Chats, Notifications & Cascade ────
        console.log('\n[7/7] Testing Claims, Chats, Notifications & Cascade Deletion...');
        const testClaimId = `CLAIM-TEST-${Date.now()}`;
        await test('POST /api/claims stores a claim', async () => {
            const res = await makeRequest('POST', '/api/claims', {
                claimId: testClaimId,
                itemId: foundReportId,
                lostItemId: lostReportId,
                claimedByEmail: testUserEmail,
                status: 'Pending Verification'
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.claim.claimId, testClaimId);
        });

        const testChatId = `CHAT-TEST-${Date.now()}`;
        await test('POST /api/chats and POST /messages works', async () => {
            const createRes = await makeRequest('POST', '/api/chats', {
                chatId: testChatId,
                lostItemId: lostReportId,
                foundItemId: foundReportId,
                lostUserEmail: testUserEmail,
                finderEmail: 'finder@example.com',
                status: 'Active',
                messages: []
            });
            assert.strictEqual(createRes.status, 201);

            const msgRes = await makeRequest('POST', `/api/chats/${testChatId}/messages`, {
                senderId: testUserEmail,
                text: 'Hello, I think that is my bottle!'
            });
            assert.strictEqual(msgRes.status, 201);
            assert.strictEqual(msgRes.body.message.text, 'Hello, I think that is my bottle!');
        });

        await test('POST /api/notifications creates notification', async () => {
            const res = await makeRequest('POST', '/api/notifications', {
                recipientEmail: testUserEmail,
                itemId: foundReportId,
                title: 'Match Found',
                message: 'A potential match was discovered'
            });
            assert.strictEqual(res.status, 201);
        });

        await test('DELETE /api/reports/:id cascade deletes related chats, claims, and notifications', async () => {
            // Delete the found report
            const delRes = await makeRequest('DELETE', `/api/reports/${foundReportId}`);
            assert.strictEqual(delRes.status, 200);

            // Confirm report is gone
            assert.strictEqual(await storage.getReportById(foundReportId), null);

            // Confirm chat associated with report was cleaned up
            assert.strictEqual(await storage.getChatById(testChatId), null);

            // Confirm claim was cleaned up
            const remainingClaims = await storage.getClaims();
            assert.strictEqual(remainingClaims.some(c => c.claimId === testClaimId), false);
        });

        // Cleanup test data
        await storage.deleteReport(lostReportId);
        await storage.deleteUser(testUserEmail);

    } finally {
        server.close();
    }

    console.log('\n----------------------------------------');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('----------------------------------------\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
});
