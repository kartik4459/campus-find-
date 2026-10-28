const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
    let uri = process.env.MONGODB_URI;

    if (!uri) {
        console.warn('[MongoDB Atlas] Warning: MONGODB_URI is not set in .env. Running in local fallback mode.');
        return false;
    }

    // Automatically strip accidental angle brackets around password
    if (uri.includes('<') && uri.includes('>')) {
        uri = uri.replace(/<([^>]+)>/g, '$1');
    }

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000
        });
        isConnected = true;
        console.log('[MongoDB Atlas] Connected successfully to Atlas cluster.');
        return true;
    } catch (err) {
        console.error('[MongoDB Atlas] Connection error:', err.message);
        console.error('[MongoDB Atlas] ACTION REQUIRED: Add your IP to MongoDB Atlas:');
        console.error('  1. Go to cloud.mongodb.com -> Network Access');
        console.error('  2. Click "Add IP Address"');
        console.error('  3. Select "Allow Access from Anywhere" (0.0.0.0/0) or add your current IP.');
        return false;
    }
}

function getIsConnected() {
    return isConnected && mongoose.connection.readyState === 1;
}

module.exports = {
    connectDB,
    getIsConnected
};
