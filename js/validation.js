/**
 * Campus Lost & Found System - Form Validation & UI Helpers (validation.js)
 */

const ValidationModule = {
    /**
     * Validates report submission form data
     */
    validateReportForm(formData) {
        const errors = {};

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
            const selectedDate = new Date(formData.date);
            const today = new Date();
            if (selectedDate > today) {
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

        if (!formData.contactEmail || !this.isValidEmail(formData.contactEmail)) {
            errors.contactEmail = "Please enter a valid university or personal email address.";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    /**
     * Simple Email pattern validator
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email.trim());
    },

    /**
     * Password security validator: min 8 chars, 1 letter, 1 number, 1 special char
     */
    validatePasswordSecurity(password) {
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
    },

    /**
     * Show validation error messages in form elements
     */
    displayFormErrors(errors, formElement) {
        // Clear previous error messages
        const errorElements = formElement.querySelectorAll('.invalid-feedback');
        errorElements.forEach(el => el.textContent = '');

        const inputs = formElement.querySelectorAll('.is-invalid');
        inputs.forEach(el => el.classList.remove('is-invalid'));

        // Highlight fields with errors
        Object.keys(errors).forEach(field => {
            const inputEl = formElement.querySelector(`[name="${field}"]`) || formElement.querySelector(`#${field}`);
            if (inputEl) {
                inputEl.classList.add('is-invalid');
                const feedbackEl = formElement.querySelector(`#${field}-error`) || inputEl.nextElementSibling;
                if (feedbackEl && feedbackEl.classList.contains('invalid-feedback')) {
                    feedbackEl.textContent = errors[field];
                }
            }
        });
    },

    /**
     * Show Bootstrap Alert or Toast Message
     */
    showAlert(message, type = 'success', containerId = 'alert-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show shadow-sm border-0 mb-3`;
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="bi ${type === 'success' ? 'bi-check-circle-fill me-2 fs-5' : 'bi-exclamation-triangle-fill me-2 fs-5'}"></i>
                <div>${message}</div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        container.appendChild(alertDiv);

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 4000);
    }
};
