const fs = require('fs');
const path = require('path');
const { getIsConnected } = require('../config/db');

// Mongoose Models
const User = require('../models/User');
const Report = require('../models/Report');
const Claim = require('../models/Claim');
const Chat = require('../models/Chat');
const Notification = require('../models/Notification');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

const INITIAL_STORE = {
    users: [],
    reports: [],
    claims: [],
    chats: [],
    notifications: []
};

let memoryStore = null;

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function loadLocalStore() {
    if (memoryStore) return memoryStore;
    ensureDataDir();

    if (!fs.existsSync(STORE_FILE)) {
        memoryStore = JSON.parse(JSON.stringify(INITIAL_STORE));
        saveLocalStore();
        return memoryStore;
    }

    try {
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        memoryStore = {
            users: Array.isArray(parsed.users) ? parsed.users : [],
            reports: Array.isArray(parsed.reports) ? parsed.reports : [],
            claims: Array.isArray(parsed.claims) ? parsed.claims : [],
            chats: Array.isArray(parsed.chats) ? parsed.chats : [],
            notifications: Array.isArray(parsed.notifications) ? parsed.notifications : []
        };
    } catch (err) {
        console.error('[StorageService] Failed to parse store.json:', err);
        memoryStore = JSON.parse(JSON.stringify(INITIAL_STORE));
    }
    return memoryStore;
}

function saveLocalStore() {
    if (!memoryStore) return;
    ensureDataDir();
    try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
    } catch (err) {
        console.error('[StorageService] Failed to persist store.json:', err);
    }
}

function sameIdString(id1, id2) {
    if (!id1 || !id2) return false;
    return String(id1).toLowerCase().trim() === String(id2).toLowerCase().trim();
}

// ==========================================
//  USERS
// ==========================================
async function getUsers() {
    if (getIsConnected()) {
        try {
            return await User.find({}).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB getUsers error:', err);
        }
    }
    return loadLocalStore().users;
}

async function findUserByEmail(email) {
    if (!email) return null;
    const key = email.toLowerCase().trim();
    if (getIsConnected()) {
        try {
            return await User.findOne({ useremail: key }).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB findUserByEmail error:', err);
        }
    }
    return (await getUsers()).find(u => u.useremail && u.useremail.toLowerCase().trim() === key) || null;
}

async function findUserByStudentId(studentId) {
    if (!studentId) return null;
    const key = studentId.toLowerCase().trim();
    if (getIsConnected()) {
        try {
            return await User.findOne({ studentId: { $regex: new RegExp(`^${key}$`, 'i') } }).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB findUserByStudentId error:', err);
        }
    }
    return (await getUsers()).find(u => u.studentId && u.studentId.toLowerCase().trim() === key) || null;
}

async function saveUser(user) {
    if (!user || !user.useremail) return null;
    const emailKey = user.useremail.toLowerCase().trim();

    if (getIsConnected()) {
        try {
            const updated = await User.findOneAndUpdate(
                { useremail: emailKey },
                { $set: user },
                { upsert: true, new: true }
            ).lean();
            return updated;
        } catch (err) {
            console.error('[StorageService] MongoDB saveUser error:', err);
        }
    }

    const store = loadLocalStore();
    const idx = store.users.findIndex(u => u.useremail && u.useremail.toLowerCase().trim() === emailKey);
    if (idx >= 0) {
        store.users[idx] = Object.assign({}, store.users[idx], user);
    } else {
        store.users.push(user);
    }
    saveLocalStore();
    return await findUserByEmail(user.useremail);
}

async function setUserBanned(email, banned) {
    if (!email) return false;
    const key = email.toLowerCase().trim();

    if (getIsConnected()) {
        try {
            const res = await User.updateOne({ useremail: key }, { $set: { banned: !!banned } });
            return res.matchedCount > 0;
        } catch (err) {
            console.error('[StorageService] MongoDB setUserBanned error:', err);
        }
    }

    const store = loadLocalStore();
    const idx = store.users.findIndex(u => u.useremail && u.useremail.toLowerCase().trim() === key);
    if (idx === -1) return false;
    store.users[idx].banned = !!banned;
    saveLocalStore();
    return true;
}

async function deleteUser(email) {
    if (!email) return false;
    const key = email.toLowerCase().trim();

    if (getIsConnected()) {
        try {
            const res = await User.deleteOne({ useremail: key });
            return res.deletedCount > 0;
        } catch (err) {
            console.error('[StorageService] MongoDB deleteUser error:', err);
        }
    }

    const store = loadLocalStore();
    const beforeCount = store.users.length;
    store.users = store.users.filter(u => !(u.useremail && u.useremail.toLowerCase().trim() === key));
    saveLocalStore();
    return store.users.length < beforeCount;
}

// ==========================================
//  REPORTS
// ==========================================
async function getReports() {
    if (getIsConnected()) {
        try {
            return await Report.find({}).sort({ createdAt: -1 }).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB getReports error:', err);
        }
    }
    return loadLocalStore().reports;
}

async function getReportById(id) {
    if (!id) return null;
    if (getIsConnected()) {
        try {
            return await Report.findOne({ id }).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB getReportById error:', err);
        }
    }
    return (await getReports()).find(r => sameIdString(r.id, id)) || null;
}

async function saveReport(report) {
    if (!report || !report.id) return null;

    if (getIsConnected()) {
        try {
            const saved = await Report.findOneAndUpdate(
                { id: report.id },
                { $set: report },
                { upsert: true, new: true }
            ).lean();
            return saved;
        } catch (err) {
            console.error('[StorageService] MongoDB saveReport error:', err);
        }
    }

    const store = loadLocalStore();
    const idx = store.reports.findIndex(r => sameIdString(r.id, report.id));
    if (idx >= 0) {
        store.reports[idx] = Object.assign({}, store.reports[idx], report);
    } else {
        store.reports.unshift(report);
    }
    saveLocalStore();
    return report;
}

async function deleteReport(id) {
    if (!id) return false;

    if (getIsConnected()) {
        try {
            // 1. Cascade clean chats
            const deletedChats = await Chat.find({
                $or: [
                    { lostItemId: id },
                    { foundItemId: id }
                ]
            }).lean();
            const deletedChatIds = deletedChats.map(c => c.chatId);
            await Chat.deleteMany({
                $or: [
                    { lostItemId: id },
                    { foundItemId: id }
                ]
            });

            // 2. Cascade clean claims
            const deletedClaims = await Claim.find({
                $or: [
                    { itemId: id },
                    { reportId: id },
                    { lostItemId: id },
                    { foundItemId: id },
                    { targetItemId: id },
                    { chatId: { $in: deletedChatIds } }
                ]
            }).lean();
            const deletedClaimIds = deletedClaims.map(c => c.claimId);
            await Claim.deleteMany({
                $or: [
                    { itemId: id },
                    { reportId: id },
                    { lostItemId: id },
                    { foundItemId: id },
                    { targetItemId: id },
                    { chatId: { $in: deletedChatIds } }
                ]
            });

            // 3. Cascade clean notifications
            await Notification.deleteMany({
                $or: [
                    { itemId: id },
                    { reportId: id },
                    { claimId: { $in: deletedClaimIds } },
                    { chatId: { $in: deletedChatIds } },
                    { link: { $regex: new RegExp(id, 'i') } }
                ]
            });

            // 4. Delete report
            const res = await Report.deleteOne({ id });
            return res.deletedCount > 0;
        } catch (err) {
            console.error('[StorageService] MongoDB deleteReport error:', err);
        }
    }

    const store = loadLocalStore();
    const deletedChatIds = [];
    store.chats = store.chats.filter(c => {
        if (!c) return false;
        const matchesId = sameIdString(c.lostItemId, id) || sameIdString(c.foundItemId, id) ||
                          sameIdString(c.itemId, id) || sameIdString(c.reportId, id);
        if (matchesId) {
            if (c.chatId) deletedChatIds.push(c.chatId);
            return false;
        }
        return true;
    });

    const deletedClaimIds = [];
    store.claims = store.claims.filter(c => {
        if (!c) return false;
        const matchesId = sameIdString(c.lostItemId, id) || sameIdString(c.foundItemId, id) ||
                          sameIdString(c.targetItemId, id) || sameIdString(c.reportId, id) ||
                          sameIdString(c.itemId, id);
        const matchesDeletedChat = c.chatId && deletedChatIds.some(dcId => sameIdString(c.chatId, dcId));
        if (matchesId || matchesDeletedChat) {
            if (c.claimId) deletedClaimIds.push(c.claimId);
            return false;
        }
        return true;
    });

    store.notifications = store.notifications.filter(n => {
        if (!n) return false;
        const hasDirectIdRef = sameIdString(n.itemId, id) || sameIdString(n.reportId, id) || sameIdString(n.targetItemId, id) ||
                              sameIdString(n.lostItemId, id) || sameIdString(n.foundItemId, id) ||
                              (n.link && typeof n.link === 'string' && n.link.toLowerCase().indexOf(String(id).toLowerCase().trim()) !== -1);
        const hasClaimIdRef = n.claimId && deletedClaimIds.some(dcId => sameIdString(n.claimId, dcId));
        const hasChatIdRef = n.chatId && deletedChatIds.some(dcId => sameIdString(n.chatId, dcId));

        return !(hasDirectIdRef || hasClaimIdRef || hasChatIdRef);
    });

    const beforeCount = store.reports.length;
    store.reports = store.reports.filter(r => r && !sameIdString(r.id, id));
    saveLocalStore();
    return store.reports.length < beforeCount;
}

// ==========================================
//  CLAIMS
// ==========================================
async function getClaims() {
    if (getIsConnected()) {
        try {
            return await Claim.find({}).sort({ createdAt: -1 }).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB getClaims error:', err);
        }
    }
    const store = loadLocalStore();
    const reportIds = {};
    store.reports.forEach(r => { if (r && r.id) reportIds[String(r.id).toLowerCase().trim()] = true; });

    let hasOrphans = false;
    const validClaims = store.claims.filter(c => {
        if (!c) return false;
        let isOrphan = false;
        if (c.itemId && !reportIds[String(c.itemId).toLowerCase().trim()]) isOrphan = true;
        if (c.reportId && !reportIds[String(c.reportId).toLowerCase().trim()]) isOrphan = true;
        if (c.lostItemId && !reportIds[String(c.lostItemId).toLowerCase().trim()]) isOrphan = true;
        if (c.foundItemId && !reportIds[String(c.foundItemId).toLowerCase().trim()]) isOrphan = true;
        if (c.targetItemId && !reportIds[String(c.targetItemId).toLowerCase().trim()]) isOrphan = true;
        if (isOrphan) hasOrphans = true;
        return !isOrphan;
    });

    if (hasOrphans) {
        store.claims = validClaims;
        saveLocalStore();
    }
    return validClaims;
}

async function saveClaim(claim) {
    if (!claim) return null;

    if (getIsConnected()) {
        try {
            const saved = await Claim.findOneAndUpdate(
                { claimId: claim.claimId },
                { $set: claim },
                { upsert: true, new: true }
            ).lean();
            return saved;
        } catch (err) {
            console.error('[StorageService] MongoDB saveClaim error:', err);
        }
    }

    const store = loadLocalStore();
    await getClaims();
    const idx = store.claims.findIndex(c => sameIdString(c.claimId, claim.claimId));
    if (idx >= 0) {
        store.claims[idx] = Object.assign({}, store.claims[idx], claim);
    } else {
        store.claims.unshift(claim);
    }
    saveLocalStore();
    return claim;
}

async function updateClaimStatus(claimId, status, extraData) {
    if (getIsConnected()) {
        try {
            const updateFields = { status };
            if (extraData) {
                if (extraData.location) {
                    updateFields.meetingDetails = extraData;
                } else {
                    if (extraData.meetingDetails) updateFields.meetingDetails = extraData.meetingDetails;
                    if (extraData.founderFeedback !== undefined) updateFields.founderFeedback = extraData.founderFeedback;
                    if (extraData.rejectionReason !== undefined) updateFields.rejectionReason = extraData.rejectionReason;
                    if (extraData.providedProof !== undefined) updateFields.providedProof = extraData.providedProof;
                }
            }
            return await Claim.findOneAndUpdate({ claimId }, { $set: updateFields }, { new: true }).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB updateClaimStatus error:', err);
        }
    }

    const store = loadLocalStore();
    const claim = store.claims.find(c => sameIdString(c.claimId, claimId));
    if (!claim) return null;
    claim.status = status;
    if (extraData) {
        if (extraData.location) {
            claim.meetingDetails = extraData;
        } else {
            if (extraData.meetingDetails) claim.meetingDetails = extraData.meetingDetails;
            if (extraData.founderFeedback !== undefined) claim.founderFeedback = extraData.founderFeedback;
            if (extraData.rejectionReason !== undefined) claim.rejectionReason = extraData.rejectionReason;
            if (extraData.providedProof !== undefined) claim.providedProof = extraData.providedProof;
        }
    }
    saveLocalStore();
    return claim;
}

// ==========================================
//  CHATS
// ==========================================
async function getChats() {
    if (getIsConnected()) {
        try {
            return await Chat.find({}).sort({ updatedAt: -1 }).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB getChats error:', err);
        }
    }
    const store = loadLocalStore();
    return store.chats;
}

async function getChatById(chatId) {
    if (!chatId) return null;
    if (getIsConnected()) {
        try {
            return await Chat.findOne({ chatId }).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB getChatById error:', err);
        }
    }
    return (await getChats()).find(c => sameIdString(c.chatId, chatId)) || null;
}

async function getChatByPair(lostItemId, foundItemId) {
    if (getIsConnected()) {
        try {
            return await Chat.findOne({
                lostItemId,
                foundItemId
            }).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB getChatByPair error:', err);
        }
    }
    return (await getChats()).find(c => sameIdString(c.lostItemId, lostItemId) && sameIdString(c.foundItemId, foundItemId)) || null;
}

async function saveChat(chat) {
    if (!chat || !chat.chatId) return null;

    if (getIsConnected()) {
        try {
            return await Chat.findOneAndUpdate(
                { chatId: chat.chatId },
                { $set: chat },
                { upsert: true, new: true }
            ).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB saveChat error:', err);
        }
    }

    const store = loadLocalStore();
    const idx = store.chats.findIndex(c => sameIdString(c.chatId, chat.chatId));
    if (idx >= 0) {
        store.chats[idx] = Object.assign({}, store.chats[idx], chat);
    } else {
        store.chats.unshift(chat);
    }
    saveLocalStore();
    return chat;
}

async function sendChatMessage(chatId, message) {
    if (getIsConnected()) {
        try {
            return await Chat.findOneAndUpdate(
                { chatId },
                {
                    $push: { messages: message },
                    $set: { updatedAt: new Date() }
                },
                { new: true }
            ).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB sendChatMessage error:', err);
        }
    }

    const store = loadLocalStore();
    const chat = store.chats.find(c => sameIdString(c.chatId, chatId));
    if (!chat) return null;
    if (!Array.isArray(chat.messages)) chat.messages = [];
    chat.messages.push(message);
    chat.updatedAt = new Date().toISOString();
    saveLocalStore();
    return chat;
}

async function updateChatStatus(chatId, status, recoveryDetails) {
    if (getIsConnected()) {
        try {
            const updateFields = { status, updatedAt: new Date() };
            if (recoveryDetails) updateFields.recoveryDetails = recoveryDetails;
            return await Chat.findOneAndUpdate({ chatId }, { $set: updateFields }, { new: true }).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB updateChatStatus error:', err);
        }
    }

    const store = loadLocalStore();
    const chat = store.chats.find(c => sameIdString(c.chatId, chatId));
    if (!chat) return null;
    chat.status = status;
    if (recoveryDetails) chat.recoveryDetails = recoveryDetails;
    chat.updatedAt = new Date().toISOString();
    saveLocalStore();
    return chat;
}

async function markChatMessagesRead(chatId, userEmail) {
    if (getIsConnected()) {
        try {
            const chat = await Chat.findOne({ chatId });
            if (!chat) return null;
            chat.messages.forEach(m => {
                if (m.senderId !== userEmail) m.read = true;
            });
            await chat.save();
            return chat.toObject();
        } catch (err) {
            console.error('[StorageService] MongoDB markChatMessagesRead error:', err);
        }
    }

    const store = loadLocalStore();
    const chat = store.chats.find(c => sameIdString(c.chatId, chatId));
    if (!chat || !Array.isArray(chat.messages)) return null;
    chat.messages.forEach(m => {
        if (m.senderId !== userEmail) m.read = true;
    });
    saveLocalStore();
    return chat;
}

// ==========================================
//  NOTIFICATIONS
// ==========================================
async function getNotifications(userEmail) {
    if (getIsConnected()) {
        try {
            const query = userEmail ? { recipientEmail: userEmail.toLowerCase().trim() } : {};
            return await Notification.find(query).sort({ timestamp: -1 }).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB getNotifications error:', err);
        }
    }

    const store = loadLocalStore();
    if (!userEmail) return store.notifications;
    const target = userEmail.toLowerCase().trim();
    return store.notifications.filter(n => n.recipientEmail && n.recipientEmail.toLowerCase().trim() === target);
}

async function sendNotification(notification) {
    if (!notification) return null;

    if (getIsConnected()) {
        try {
            const saved = await Notification.findOneAndUpdate(
                { id: notification.id },
                { $set: notification },
                { upsert: true, new: true }
            ).lean();
            return saved;
        } catch (err) {
            console.error('[StorageService] MongoDB sendNotification error:', err);
        }
    }

    const store = loadLocalStore();
    if (notification.read === undefined) {
        notification.read = false;
    }
    store.notifications.unshift(notification);
    saveLocalStore();
    return notification;
}

async function markNotificationAsRead(notifId) {
    if (getIsConnected()) {
        try {
            return await Notification.findOneAndUpdate({ id: notifId }, { $set: { read: true } }, { new: true }).lean();
        } catch (err) {
            console.error('[StorageService] MongoDB markNotificationAsRead error:', err);
        }
    }

    const store = loadLocalStore();
    const idx = store.notifications.findIndex(n => sameIdString(n.id, notifId));
    if (idx >= 0) {
        store.notifications[idx].read = true;
        saveLocalStore();
        return store.notifications[idx];
    }
    return null;
}

async function clearNotifications(userEmail) {
    if (!userEmail) return false;
    const target = userEmail.toLowerCase().trim();

    if (getIsConnected()) {
        try {
            const res = await Notification.deleteMany({ recipientEmail: target });
            return res.deletedCount > 0;
        } catch (err) {
            console.error('[StorageService] MongoDB clearNotifications error:', err);
        }
    }

    const store = loadLocalStore();
    store.notifications = store.notifications.filter(n => !n.recipientEmail || n.recipientEmail.toLowerCase().trim() !== target);
    saveLocalStore();
    return true;
}

async function deleteNotification(notifId) {
    if (!notifId) return false;

    if (getIsConnected()) {
        try {
            const res = await Notification.deleteOne({ id: notifId });
            return res.deletedCount > 0;
        } catch (err) {
            console.error('[StorageService] MongoDB deleteNotification error:', err);
        }
    }

    const store = loadLocalStore();
    const before = store.notifications.length;
    store.notifications = store.notifications.filter(n => !sameIdString(n.id, notifId));
    saveLocalStore();
    return store.notifications.length < before;
}

// ==========================================
//  FULL STORE SYNC
// ==========================================
async function getAllData() {
    return {
        users: await getUsers(),
        reports: await getReports(),
        claims: await getClaims(),
        chats: await getChats(),
        notifications: await getNotifications()
    };
}

module.exports = {
    loadLocalStore,
    saveLocalStore,
    sameIdString,
    getUsers,
    findUserByEmail,
    findUserByStudentId,
    saveUser,
    setUserBanned,
    deleteUser,
    getReports,
    getReportById,
    saveReport,
    deleteReport,
    getClaims,
    saveClaim,
    updateClaimStatus,
    getChats,
    getChatById,
    getChatByPair,
    saveChat,
    sendChatMessage,
    updateChatStatus,
    markChatMessagesRead,
    getNotifications,
    sendNotification,
    markNotificationAsRead,
    clearNotifications,
    deleteNotification,
    getAllData
};
