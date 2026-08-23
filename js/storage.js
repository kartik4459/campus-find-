// ============================================================
//  storage.js  —  CampusFind LocalStorage Data Layer
//
//  Keys used:
//    campusfind_users        → JSON array of all registered user objects
//    current_user            → JSON object of the currently logged-in user
//    isLoggedIn              → "true" | "false"
//    campus_reports          → JSON array of all lost/found reports
//    campus_claims           → JSON array of all claim objects
//    campus_notifications    → JSON array of all notification objects
//    campus_chats            → JSON array of all chat objects
//    theme                   → "light" | "dark"
// ============================================================

// ── Theme (runs immediately to prevent flash) ────────────────
(function () {
    var theme = localStorage.getItem("theme");
    if (theme === "light") {
        document.documentElement.classList.add("light-theme");
    } else {
        document.documentElement.classList.remove("light-theme");
    }
})();

// ── Global HTML escaper (used by all pages) ──────────────────
function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ── Safe JSON parser ─────────────────────────────────────────
function safeParseJSON(raw, fallback) {
    if (!raw) return fallback;
    try {
        var parsed = JSON.parse(raw);
        return (parsed !== null && parsed !== undefined) ? parsed : fallback;
    } catch (e) {
        return fallback;
    }
}

// ============================================================
//  STORAGE INIT
//  Called once on script load.
//  Only creates keys that do NOT already exist.
//  NEVER overwrites existing user or report data.
// ============================================================
function initStorage() {
    // ── Users array ──────────────────────────────────────────
    var usersRaw = localStorage.getItem("campusfind_users");
    if (!usersRaw) {
        // First run: start with empty array
        localStorage.setItem("campusfind_users", JSON.stringify([]));
    } else {
        // Validate it's actually an array; repair if corrupted
        var parsed = safeParseJSON(usersRaw, null);
        if (!Array.isArray(parsed)) {
            localStorage.setItem("campusfind_users", JSON.stringify([]));
        }
    }

    // ── One-time migration from old "users" key ───────────────
    // If someone registered with an older version of the site,
    // their data was under "users". Migrate it once, then remove.
    var oldKey = localStorage.getItem("users");
    if (oldKey) {
        var oldUsers = safeParseJSON(oldKey, []);
        if (Array.isArray(oldUsers)) {
            oldUsers.forEach(function(u) {
                // Skip the original fake demo seeds
                if (!u.useremail) return;
                var em = u.useremail.toLowerCase();
                if (em === "ira.sodhi@example.com" || em === "rohan.verma@example.com") return;
                saveUser(u); // saveUser is idempotent — won't duplicate
            });
        }
        localStorage.removeItem("users");
    }

    // ── Reports — start empty, NEVER seed fake data ──────────
    if (!localStorage.getItem("campus_reports")) {
        localStorage.setItem("campus_reports", JSON.stringify([]));
    }

    // ── Claims ───────────────────────────────────────────────
    if (!localStorage.getItem("campus_claims")) {
        localStorage.setItem("campus_claims", JSON.stringify([]));
    }

    // ── Notifications ─────────────────────────────────────────
    if (!localStorage.getItem("campus_notifications")) {
        localStorage.setItem("campus_notifications", JSON.stringify([]));
    }

    // ── Chats ─────────────────────────────────────────────────
    if (!localStorage.getItem("campus_chats")) {
        localStorage.setItem("campus_chats", JSON.stringify([]));
    }
}

// Run immediately when the script is loaded
initStorage();

// ============================================================
//  USER ACCOUNT FUNCTIONS
// ============================================================

/**
 * Return all registered users as an array.
 * Reads from "campusfind_users". Returns [] if empty or invalid.
 */
function getUsers() {
    var raw = localStorage.getItem("campusfind_users");
    var users = safeParseJSON(raw, []);
    return Array.isArray(users) ? users : [];
}

/**
 * Save a new user OR update an existing one (matched by email).
 * Never deletes other users.
 */
function saveUser(user) {
    if (!user || !user.useremail) {
        console.warn("[CampusFind] saveUser: invalid user object", user);
        return;
    }
    var users = getUsers();
    var emailKey = user.useremail.toLowerCase().trim();
    var idx = users.findIndex(function(u) {
        return u.useremail && u.useremail.toLowerCase().trim() === emailKey;
    });
    if (idx >= 0) {
        // Update existing — merge properties
        users[idx] = Object.assign({}, users[idx], user);
    } else {
        // New user — append
        users.push(user);
    }
    localStorage.setItem("campusfind_users", JSON.stringify(users));
}

/**
 * Find a registered user by email (case-insensitive).
 * Returns the user object or null.
 */
function findUserByEmail(email) {
    if (!email) return null;
    var key = email.toLowerCase().trim();
    return getUsers().find(function(u) {
        return u.useremail && u.useremail.toLowerCase().trim() === key;
    }) || null;
}

/**
 * Find a registered user by studentId (case-insensitive).
 * Returns the user object or null.
 */
function findUserByStudentId(studentId) {
    if (!studentId) return null;
    var key = studentId.toLowerCase().trim();
    return getUsers().find(function(u) {
        return u.studentId && u.studentId.toLowerCase().trim() === key;
    }) || null;
}

// ============================================================
//  ADMIN CONFIG
//  Hardcoded whitelist of admin accounts. This is the ONLY way
//  to become an admin — add/remove trusted emails here directly
//  in the source. There is no in-app promotion.
// ============================================================
var ADMIN_EMAILS = [
    "kartikey3214.beai24@chitkara.edu.in"
    // add more trusted admin emails here, one per line
];

function isAdminUser(user) {
    if (!user || !user.useremail) return false;
    var email = user.useremail.toLowerCase().trim();
    return ADMIN_EMAILS.some(function(e) {
        return e.toLowerCase().trim() === email;
    });
}
// ============================================================
//  SESSION FUNCTIONS
// ============================================================

/**
 * Set the active session.
 * Saves the FULL user object to "current_user" and marks isLoggedIn.
 * Also writes email to "campusfind_current_user" for compatibility.
 */
function setCurrentSession(email) {
    if (!email) return;
    var normalEmail = email.toLowerCase().trim();
    var user = findUserByEmail(normalEmail);
    if (!user) return;
    localStorage.setItem("current_user", JSON.stringify(user));
    localStorage.setItem("campusfind_current_user", normalEmail);
    localStorage.setItem("isLoggedIn", "true");
}

/**
 * Return the currently logged-in user object.
 * Tries "current_user" JSON blob first (fast path),
 * then falls back to "campusfind_current_user" email → lookup.
 * Returns null if no session exists.
 */
function getCurrentUser() {
    // ── Fast path: full user object in current_user ─────────
    try {
        var raw = localStorage.getItem("current_user");
        if (raw && raw !== "null" && raw !== "") {
            var user = JSON.parse(raw);
            if (user && user.useremail) {
                // Re-fetch from the users array to ensure data is fresh
                var fresh = findUserByEmail(user.useremail);
                if (fresh) return fresh;
                // User was in current_user but not in campusfind_users → re-register
                saveUser(user);
                return user;
            }
        }
    } catch (e) { /* corrupted JSON */ }

    // ── Fallback: email pointer in campusfind_current_user ───
    try {
        var sessionEmail = localStorage.getItem("campusfind_current_user");
        if (sessionEmail) {
            var found = findUserByEmail(sessionEmail);
            if (found) {
                // Repair the current_user blob for next time
                localStorage.setItem("current_user", JSON.stringify(found));
                return found;
            }
        }
    } catch (e) { /* ignore */ }

    return null;
}

/**
 * Clear the active session (logout).
 * Keeps campusfind_users intact — accounts survive logout.
 */
function clearCurrentSession() {
    localStorage.removeItem("current_user");
    localStorage.removeItem("campusfind_current_user");
    localStorage.setItem("isLoggedIn", "false");
}

/**
 * Switch active account to another registered user by email.
 * Returns the user object, or null if not found.
 */
function switchUser(email) {
    if (!email) return null;
    var user = findUserByEmail(email);
    if (user) {
        setCurrentSession(user.useremail);
        return user;
    }
    return null;
}

function setUserBanned(email, banned) {
    if (!email) return;
    var users = getUsers();
    var key = email.toLowerCase().trim();
    var idx = users.findIndex(function(u) {
        return u.useremail && u.useremail.toLowerCase().trim() === key;
    });
    if (idx === -1) return;
    users[idx].banned = !!banned;
    localStorage.setItem("campusfind_users", JSON.stringify(users));
}

function deleteUser(email) {
    if (!email) return;
    var key = email.toLowerCase().trim();
    var users = getUsers().filter(function(u) {
        return !(u.useremail && u.useremail.toLowerCase().trim() === key);
    });
    localStorage.setItem("campusfind_users", JSON.stringify(users));
}

// ============================================================
//  REPORT FUNCTIONS
// ============================================================

/**
 * Return all reports from localStorage as an array.
 */
function getReports() {
    return safeParseJSON(localStorage.getItem("campus_reports"), []);
}

/**
 * Prepend a new report to the campus_reports array and save.
 */
function saveReport(report) {
    var reports = getReports();
    reports.unshift(report);
    localStorage.setItem("campus_reports", JSON.stringify(reports));
}

/**
 * Remove a report by its ID.
 */
function deleteReport(id) {
    var reports = getReports().filter(function(r) { return r.id !== id; });
    localStorage.setItem("campus_reports", JSON.stringify(reports));
}

// ============================================================
//  CLAIM FUNCTIONS
// ============================================================

function getClaims() {
    return safeParseJSON(localStorage.getItem("campus_claims"), []);
}

function saveClaim(claim) {
    var claims = getClaims();
    claims.unshift(claim);
    localStorage.setItem("campus_claims", JSON.stringify(claims));
}

function updateClaimStatus(claimId, status, extraData) {
    var claims = getClaims();
    var claim = claims.find(function(c) { return c.claimId === claimId; });
    if (!claim) return;
    claim.status = status;
    if (extraData) {
        if (extraData.location) {
            claim.meetingDetails = extraData;
        } else {
            if (extraData.meetingDetails)                claim.meetingDetails  = extraData.meetingDetails;
            if (extraData.founderFeedback !== undefined) claim.founderFeedback = extraData.founderFeedback;
            if (extraData.rejectionReason !== undefined) claim.rejectionReason = extraData.rejectionReason;
            if (extraData.providedProof   !== undefined) claim.providedProof   = extraData.providedProof;
        }
    }
    localStorage.setItem("campus_claims", JSON.stringify(claims));
}

// ============================================================
//  NOTIFICATION FUNCTIONS
// ============================================================

function getNotifications(userEmail) {
    if (!userEmail) return [];
    var all = safeParseJSON(localStorage.getItem("campus_notifications"), []);
    var target = userEmail.toLowerCase().trim();
    return all.filter(function(n) {
        return n.recipientEmail && n.recipientEmail.toLowerCase().trim() === target;
    });
}

function sendNotification(notification) {
    var all = safeParseJSON(localStorage.getItem("campus_notifications"), []);
    all.unshift(notification);
    localStorage.setItem("campus_notifications", JSON.stringify(all));
}

function clearNotifications(userEmail) {
    if (!userEmail) return;
    var all = safeParseJSON(localStorage.getItem("campus_notifications"), []);
    var target = userEmail.toLowerCase().trim();
    var remaining = all.filter(function(n) {
        return !n.recipientEmail || n.recipientEmail.toLowerCase().trim() !== target;
    });
    localStorage.setItem("campus_notifications", JSON.stringify(remaining));
}

function deleteNotification(notifId) {
    if (!notifId) return;
    var all = safeParseJSON(localStorage.getItem("campus_notifications"), []);
    var remaining = all.filter(function(n) { return n.id !== notifId; });
    localStorage.setItem("campus_notifications", JSON.stringify(remaining));
}

// ============================================================
//  CHAT FUNCTIONS
// ============================================================

function getChats() {
    return safeParseJSON(localStorage.getItem("campus_chats"), []);
}

function getChatById(chatId) {
    return getChats().find(function(c) { return c.chatId === chatId; }) || null;
}

function getChatByPair(lostItemId, foundItemId) {
    return getChats().find(function(c) {
        return c.lostItemId === lostItemId && c.foundItemId === foundItemId;
    }) || null;
}

function saveChat(chat) {
    var chats = getChats();
    var idx = chats.findIndex(function(c) { return c.chatId === chat.chatId; });
    if (idx >= 0) {
        chats[idx] = chat;
    } else {
        chats.unshift(chat);
    }
    localStorage.setItem("campus_chats", JSON.stringify(chats));
}

function sendChatMessage(chatId, message) {
    var chats = getChats();
    var chat = chats.find(function(c) { return c.chatId === chatId; });
    if (!chat) return;
    chat.messages.push(message);
    chat.updatedAt = new Date().toISOString();
    localStorage.setItem("campus_chats", JSON.stringify(chats));
}

function updateChatStatus(chatId, status, recoveryDetails) {
    var chats = getChats();
    var chat = chats.find(function(c) { return c.chatId === chatId; });
    if (!chat) return;
    chat.status = status;
    if (recoveryDetails) chat.recoveryDetails = recoveryDetails;
    chat.updatedAt = new Date().toISOString();
    localStorage.setItem("campus_chats", JSON.stringify(chats));
}

function getUnreadChatCount(userEmail) {
    if (!userEmail) return 0;
    var count = 0;
    getChats().forEach(function(c) {
        if (c.lostUserEmail === userEmail || c.finderEmail === userEmail) {
            (c.messages || []).forEach(function(m) {
                if (!m.read && m.senderId !== userEmail) count++;
            });
        }
    });
    return count;
}

function markChatMessagesRead(chatId, userEmail) {
    var chats = getChats();
    var chat = chats.find(function(c) { return c.chatId === chatId; });
    if (!chat) return;
    chat.messages.forEach(function(m) {
        if (m.senderId !== userEmail) m.read = true;
    });
    localStorage.setItem("campus_chats", JSON.stringify(chats));
}

// ============================================================
//  DEV HELPER — call manually from browser console only
//  Usage: clearAllDemoData()
// ============================================================

/**
 * Wipes ALL stored data and resets to a clean blank state.
 * Does NOT run automatically — call from DevTools console only.
 *
 * Usage:  clearAllDemoData()
 */
function clearAllDemoData() {
    localStorage.setItem("campusfind_users",       JSON.stringify([]));
    localStorage.removeItem("current_user");
    localStorage.removeItem("campusfind_current_user");
    localStorage.setItem("isLoggedIn",             "false");
    localStorage.setItem("campus_reports",         JSON.stringify([]));
    localStorage.setItem("campus_claims",          JSON.stringify([]));
    localStorage.setItem("campus_notifications",   JSON.stringify([]));
    localStorage.setItem("campus_chats",           JSON.stringify([]));
    localStorage.removeItem("users"); // remove old key if still present
    console.log("[CampusFind] All data cleared. Refresh the page to start fresh.");
}

// Keep resetData() as an alias so any existing call sites still work
var resetData = clearAllDemoData;
