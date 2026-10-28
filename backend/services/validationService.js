// Server-side Validation Service

function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
}

function validatePasswordSecurity(password) {
    if (!password) return { isValid: false, reason: "Password is required." };
    const hasMinLength = password.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    const isValid = hasMinLength && hasLetter && hasNumber && hasSpecial;
    return {
        isValid,
        hasMinLength,
        hasLetter,
        hasNumber,
        hasSpecial,
        reason: isValid ? "Password is secure." : "Password must be at least 8 characters, with 1 letter, 1 digit, and 1 special character."
    };
}

function validateReportForm(formData) {
    const errors = {};
    const validTypes = ['lost', 'found'];

if (!validTypes.includes(formData.type)) {
    errors.type = "Report type must be either lost or found.";
}
    if (!formData.itemName || formData.itemName.trim().length < 3) {
        errors.itemName = "Item name must be at least 3 characters long.";
    }

    if (!formData.category) {
        errors.category = "Please select an item category.";
    }

    if (!formData.color) {
        errors.color = "Please select a primary color.";
    }

    if (!formData.zone) {
        errors.zone = "Please select a campus zone/location.";
    }

    if (!formData.date) {
        errors.date = "Please select the date item was lost or found.";
    } else {
        // The submitted date is a plain YYYY-MM-DD string from the HTML date input.
        // new Date('YYYY-MM-DD') always parses as UTC midnight, so comparing its
        // .toISOString() against today's .toISOString() fails for any timezone that
        // is ahead of UTC (e.g. IST UTC+5:30): today locally is still "yesterday" in
        // UTC, making today's local date appear to be in the future.
        //
        // Fix: build today's local date string directly from wall-clock components
        // so the comparison is purely between two YYYY-MM-DD strings, timezone-safe.
        const now = new Date();
        const todayLocal = now.getFullYear() + '-'
            + String(now.getMonth() + 1).padStart(2, '0') + '-'
            + String(now.getDate()).padStart(2, '0');
        if (formData.date > todayLocal) {
            errors.date = "Date cannot be in the future.";
        }
    }

    if (!formData.description || formData.description.trim().length < 10) {
        errors.description = "Description must be at least 10 characters long to help with matching.";
    }

    if (formData.description && formData.description.length > 500) {
        errors.description = "Description cannot exceed 500 characters.";
    }

    if (!formData.contactName || formData.contactName.trim().length < 2) {
        errors.contactName = "Please provide your full name.";
    }

    if (!formData.contactEmail || !isValidEmail(formData.contactEmail)) {
        errors.contactEmail = "Please enter a valid university or personal email address.";
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

function validateUserRegistration(data) {
    const errors = {};

    if (!data.username || data.username.trim().length < 2) {
        errors.username = "Name must be at least 2 characters long.";
    }

    if (!data.useremail || !isValidEmail(data.useremail)) {
        errors.useremail = "Please enter a valid email address.";
    }

    if (!data.contactPhone || !/^\+?[0-9\s\-]{8,}$/.test(data.contactPhone.trim())) {
        errors.contactPhone = "Please enter a valid phone number (at least 8 digits).";
    }

    if (!data.studentId || data.studentId.trim().length < 4) {
        errors.studentId = "Student ID must be at least 4 characters long.";
    }

    if (!data.department) {
        errors.department = "Department is required.";
    }

    const passCheck = validatePasswordSecurity(data.userpassword);
    if (!passCheck.isValid) {
        errors.userpassword = passCheck.reason;
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

module.exports = {
    isValidEmail,
    validatePasswordSecurity,
    validateReportForm,
    validateUserRegistration
};
