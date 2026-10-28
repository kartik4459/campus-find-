const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    recipientEmail: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    title: {
        type: String,
        trim: true
    },
    message: {
        type: String,
        trim: true
    },
    itemId: {
        type: String,
        trim: true
    },
    reportId: {
        type: String,
        trim: true
    },
    claimId: {
        type: String,
        trim: true
    },
    chatId: {
        type: String,
        trim: true
    },
    link: {
        type: String,
        trim: true
    },
    read: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
