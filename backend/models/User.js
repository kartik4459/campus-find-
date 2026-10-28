const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    useremail: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    userpassword: {
        type: String,
        required: true
    },
    contactPhone: {
        type: String,
        trim: true
    },
    studentId: {
        type: String,
        trim: true
    },
    department: {
        type: String,
        trim: true
    },
    banned: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
