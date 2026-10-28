const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['lost', 'found'],
        required: true
    },
    itemName: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    color: {
        type: String,
        required: true,
        trim: true
    },
    zone: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    contactName: {
        type: String,
        required: true,
        trim: true
    },
    contactEmail: {
        type: String,
        required: true,
        trim: true
    },
    postedByEmail: {
        type: String,
        trim: true
    },
    image: {
        type: String,
        default: null
    },
    imageFeatures: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    status: {
        type: String,
        default: 'Open'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.models.Report || mongoose.model('Report', reportSchema);
