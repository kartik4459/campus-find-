require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../backend/config/db');
const storage = require('../backend/services/storageService');

// Mongoose Models
const User = require('../backend/models/User');
const Report = require('../backend/models/Report');
const Claim = require('../backend/models/Claim');
const Chat = require('../backend/models/Chat');
const Notification = require('../backend/models/Notification');

async function migrate() {
    console.log('\n========================================');
    console.log('   CampusFind MongoDB Atlas Migration   ');
    console.log('========================================\n');

    const connected = await connectDB();
    if (!connected) {
        console.error('Migration aborted: Unable to connect to MongoDB Atlas.');
        console.error('Please check your MONGODB_URI in .env and ensure <db_password> has been replaced.\n');
        process.exit(1);
    }

    const localStore = storage.loadLocalStore();

    console.log(`Found in local store:`);
    console.log(`  - Users: ${localStore.users.length}`);
    console.log(`  - Reports: ${localStore.reports.length}`);
    console.log(`  - Claims: ${localStore.claims.length}`);
    console.log(`  - Chats: ${localStore.chats.length}`);
    console.log(`  - Notifications: ${localStore.notifications.length}\n`);

    // Migrate Users
    if (localStore.users.length > 0) {
        for (const user of localStore.users) {
            await User.findOneAndUpdate({ useremail: user.useremail.toLowerCase() }, user, { upsert: true });
        }
        console.log(`✓ Migrated ${localStore.users.length} users`);
    }

    // Migrate Reports
    if (localStore.reports.length > 0) {
        for (const report of localStore.reports) {
            await Report.findOneAndUpdate({ id: report.id }, report, { upsert: true });
        }
        console.log(`✓ Migrated ${localStore.reports.length} reports`);
    }

    // Migrate Claims
    if (localStore.claims.length > 0) {
        for (const claim of localStore.claims) {
            await Claim.findOneAndUpdate({ claimId: claim.claimId }, claim, { upsert: true });
        }
        console.log(`✓ Migrated ${localStore.claims.length} claims`);
    }

    // Migrate Chats
    if (localStore.chats.length > 0) {
        for (const chat of localStore.chats) {
            await Chat.findOneAndUpdate({ chatId: chat.chatId }, chat, { upsert: true });
        }
        console.log(`✓ Migrated ${localStore.chats.length} chats`);
    }

    // Migrate Notifications
    if (localStore.notifications.length > 0) {
        for (const notif of localStore.notifications) {
            await Notification.findOneAndUpdate({ id: notif.id }, notif, { upsert: true });
        }
        console.log(`✓ Migrated ${localStore.notifications.length} notifications`);
    }

    console.log('\nMigration to MongoDB Atlas completed successfully!\n');
    await mongoose.disconnect();
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
