// Express.js Architecture & Endpoint Audit Test
const assert = require('assert');
const http = require('http');
const express = require('express');
const app = require('../server');

function getRegisteredExpressRoutes(app) {
    const routes = [];

    function extractRoutes(stack, basePath = '') {
        stack.forEach(layer => {
            if (layer.route) {
                // Route directly on app or router
                const path = basePath + layer.route.path;
                const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
                routes.push({ path, methods });
            } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
                // Nested router
                let routerPath = '';
                if (layer.regexp) {
                    const match = layer.regexp.source
                        .replace('^\\', '')
                        .replace('\\/?(?=\\/|$)', '')
                        .replace('(?=\\/|$)', '')
                        .replace(/\\\//g, '/')
                        .replace(/\^/g, '')
                        .replace(/\$/g, '');
                    routerPath = match;
                }
                extractRoutes(layer.handle.stack, routerPath);
            }
        });
    }

    extractRoutes(app._router.stack);
    return routes;
}

function makeRequest(baseUrl, method, endpoint, body) {
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

async function runAudit() {
    console.log('\n======================================================');
    console.log('   Express.js Backend Audit & Verification Test');
    console.log('======================================================\n');

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`  ✓ ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ✗ ${name}: ${err.message}`);
            failed++;
        }
    }

    async function asyncTest(name, fn) {
        try {
            await fn();
            console.log(`  ✓ ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ✗ ${name}: ${err.message}`);
            failed++;
        }
    }

    // ── 1. Framework Identity Tests ─────────────────────────
    console.log('[1/4] Checking Express.js Framework Foundation...');
    test('Server instance is an Express Application', () => {
        assert.strictEqual(typeof app.use, 'function', 'app.use should be a function');
        assert.strictEqual(typeof app.get, 'function', 'app.get should be a function');
        assert.strictEqual(typeof app.post, 'function', 'app.post should be a function');
        assert.strictEqual(typeof app.listen, 'function', 'app.listen should be a function');
        assert(app._router && app._router.stack, 'Express router stack must be initialized');
    });

    test('All modular routes are Express.Router instances', () => {
        const reportsRouter = require('../backend/routes/reports');
        const usersRouter = require('../backend/routes/users');
        const claimsRouter = require('../backend/routes/claims');
        const chatsRouter = require('../backend/routes/chats');
        const notificationsRouter = require('../backend/routes/notifications');
        const matchingRouter = require('../backend/routes/matching');

        [reportsRouter, usersRouter, claimsRouter, chatsRouter, notificationsRouter, matchingRouter].forEach(router => {
            assert.strictEqual(typeof router, 'function', 'Router should be callable function');
            assert(router.stack && Array.isArray(router.stack), 'Router must have a stack of Express layers');
            assert.strictEqual(typeof router.get, 'function');
            assert.strictEqual(typeof router.post, 'function');
        });
    });

    // ── 2. Express Route Table Introspection ────────────────
    console.log('\n[2/4] Introspecting Express Router Table...');
    const registeredRoutes = getRegisteredExpressRoutes(app);
    console.log(`  Total Express Route Handlers Registered: ${registeredRoutes.length}`);

    test('Express routes cover all core backend modules', () => {
        const paths = registeredRoutes.map(r => r.path);
        assert(paths.some(p => p.includes('health')), 'Missing Express /api/health');
        assert(paths.some(p => p.includes('sync')), 'Missing Express /api/sync');
        assert(paths.some(p => p.includes('reports')), 'Missing Express /api/reports');
        assert(paths.some(p => p.includes('users')), 'Missing Express /api/users');
        assert(paths.some(p => p.includes('claims')), 'Missing Express /api/claims');
        assert(paths.some(p => p.includes('chats')), 'Missing Express /api/chats');
        assert(paths.some(p => p.includes('notifications')), 'Missing Express /api/notifications');
        assert(paths.some(p => p.includes('matching')), 'Missing Express /api/matching');
    });

    // ── 3. Start Server & Test All Express Endpoints ────────
    console.log('\n[3/4] Testing Every Express Route Over HTTP...');
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    try {
        await asyncTest('Express Static Middleware serves files', async () => {
            const res = await makeRequest(baseUrl, 'GET', '/');
            assert.strictEqual(res.status, 200);
            assert(typeof res.body === 'string' && res.body.includes('CampusFind'));
        });

        await asyncTest('Express handles GET /api/health', async () => {
            const res = await makeRequest(baseUrl, 'GET', '/api/health');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.status, 'ok');
        });

        await asyncTest('Express handles GET /api/sync', async () => {
            const res = await makeRequest(baseUrl, 'GET', '/api/sync');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
        });

        await asyncTest('Express handles POST /api/sync', async () => {
            const res = await makeRequest(baseUrl, 'POST', '/api/sync', { reports: [] });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
        });

        await asyncTest('Express handles GET /api/reports', async () => {
            const res = await makeRequest(baseUrl, 'GET', '/api/reports');
            assert.strictEqual(res.status, 200);
            assert(Array.isArray(res.body.reports));
        });

        await asyncTest('Express handles GET /api/users', async () => {
            const res = await makeRequest(baseUrl, 'GET', '/api/users');
            assert.strictEqual(res.status, 200);
            assert(Array.isArray(res.body.users));
        });

        await asyncTest('Express handles GET /api/claims', async () => {
            const res = await makeRequest(baseUrl, 'GET', '/api/claims');
            assert.strictEqual(res.status, 200);
            assert(Array.isArray(res.body.claims));
        });

        await asyncTest('Express handles GET /api/chats', async () => {
            const res = await makeRequest(baseUrl, 'GET', '/api/chats');
            assert.strictEqual(res.status, 200);
            assert(Array.isArray(res.body.chats));
        });

        await asyncTest('Express handles GET /api/notifications', async () => {
            const res = await makeRequest(baseUrl, 'GET', '/api/notifications');
            assert.strictEqual(res.status, 200);
            assert(Array.isArray(res.body.notifications));
        });

        await asyncTest('Express handles POST /api/matching/score', async () => {
            const res = await makeRequest(baseUrl, 'POST', '/api/matching/score', {
                targetItem: { category: 'Electronics', color: 'Black', zone: 'Library', date: '2026-08-20', description: 'Laptop' },
                candidateItem: { category: 'Electronics', color: 'Black', zone: 'Library', date: '2026-08-20', description: 'Laptop' }
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert(res.body.match && res.body.match.score > 0);
        });

        await asyncTest('Express handles POST /api/matching/find-matches', async () => {
            const res = await makeRequest(baseUrl, 'POST', '/api/matching/find-matches', {
                targetItem: { id: 'T1', type: 'lost', category: 'Books', color: 'Blue', zone: 'Main Block', date: '2026-08-20', description: 'Math book' },
                reports: []
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert(Array.isArray(res.body.matches));
        });

        // ── 4. Express Error Handling & Middleware ──────────────
        console.log('\n[4/4] Testing Express Middleware & Error Handling...');
        await asyncTest('Express returns 404 JSON for unknown API routes', async () => {
            const res = await makeRequest(baseUrl, 'GET', '/api/nonexistent-route');
            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.success, false);
            assert(res.body.error.includes('not found'));
        });

        await asyncTest('Express JSON body parser parses incoming payloads correctly', async () => {
            const res = await makeRequest(baseUrl, 'POST', '/api/users/login', {
                email: 'none@example.com',
                password: 'abc',
                studentId: '123',
                department: 'CS'
            });
            // Should get 404 "No account found", proving body was parsed and processed by Express route
            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.success, false);
            assert(res.body.error.includes('No account found'));
        });

    } finally {
        server.close();
    }

    console.log('\n======================================================');
    console.log(`   Audit Complete: ${passed} passed, ${failed} failed`);
    console.log('======================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runAudit().catch(err => {
    console.error('Audit fatal error:', err);
    process.exit(1);
});
