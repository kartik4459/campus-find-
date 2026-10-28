const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
    claimId: {
        type: String,
        required: true,
        unique: true,
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
    lostItemId: {
        type: String,
        trim: true
    },
    foundItemId: {
        type: String,
        trim: true
    },
    targetItemId: {
        type: String,
        trim: true
    },
    claimedByEmail: {
        type: String,
        trim: true
    },
    reporterEmail: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        default: 'Pending Verification'
    },
    meetingDetails: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    founderFeedback: {
        type: String,
        default: null
    },
    rejectionReason: {
        type: String,
        default: null
    },
    providedProof: {
        type: String,
        default: null
    },
    chatId: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.models.Claim || mongoose.model('Claim', claimSchema);
