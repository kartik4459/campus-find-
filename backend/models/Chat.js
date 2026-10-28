const mongoose = require('mongoose');

const messageSubSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    senderId: {
        type: String,
        required: true
    },
    senderName: {
        type: String
    },
    text: {
        type: String,
        required: true
    },
    timestamp: {
        type: String,
        default: () => new Date().toISOString()
    },
    read: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const chatSchema = new mongoose.Schema({
    chatId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    lostItemId: {
        type: String,
        trim: true
    },
    foundItemId: {
        type: String,
        trim: true
    },
    lostUserEmail: {
        type: String,
        trim: true
    },
    finderEmail: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        default: 'Active'
    },
    recoveryDetails: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    messages: {
        type: [messageSubSchema],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.models.Chat || mongoose.model('Chat', chatSchema);
