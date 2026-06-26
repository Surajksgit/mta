import { auth } from "./firebase-config.js";
import {
   signInWithPhoneNumber,
   RecaptchaVerifier,
   onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// Global Toast System
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-solid fa-circle-info';
    if (type === 'success') iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';
    
    toast.innerHTML = `
        <i class="${iconClass}"></i>
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
    let confirmationResult = null;
    let recaptchaVerifier = null;

    const authPhoneInput = document.getElementById('authPhone');
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const recaptchaContainer = document.getElementById('recaptcha-container');
    const phoneStep = document.getElementById('phoneStep');
    const otpStep = document.getElementById('otpStep');
    const otpCodeInput = document.getElementById('otpCode');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const resendOtpBtn = document.getElementById('resendOtpBtn');

    // If already logged in, redirect straight to dashboard
    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.href = "dashboard.html";
        }
    });

    function initRecaptcha() {
        if (recaptchaVerifier) return;
        
        if (recaptchaContainer) recaptchaContainer.innerHTML = '';

        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
                // reCAPTCHA solved
            }
        });
    }

    async function handleSendOTP() {
        const rawPhone = authPhoneInput.value.trim();
        if (!rawPhone) {
            showInputError(authPhoneInput, document.getElementById('error-authPhone'), "Phone number is required.");
            return;
        }

        let phoneNumber = rawPhone.replace(/[^0-9+]/g, '');
        if (!phoneNumber.startsWith('+')) {
            phoneNumber = '+1' + phoneNumber;
        }

        clearInputError(authPhoneInput, document.getElementById('error-authPhone'));
        sendOtpBtn.disabled = true;
        sendOtpBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending SMS...';

        try {
            initRecaptcha();
            confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
            
            showToast("OTP Code sent successfully!", "info");
            
            phoneStep.classList.add('hidden');
            otpStep.classList.remove('hidden');
            sendOtpBtn.disabled = false;
            sendOtpBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTP Code';
        } catch (error) {
            console.error("Failed to send SMS: ", error);
            const friendlyMessage = error.message || error.code || "Failed to send SMS.";
            showInputError(authPhoneInput, document.getElementById('error-authPhone'), friendlyMessage);
            showToast("Failed to send SMS code.", "error");
            sendOtpBtn.disabled = false;
            sendOtpBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTP Code';
            
            if (recaptchaVerifier) {
                recaptchaVerifier.clear();
                recaptchaVerifier = null;
            }
        }
    }

    async function handleVerifyOTP() {
        const code = otpCodeInput.value.trim();
        if (code.length !== 6) {
            showInputError(otpCodeInput, document.getElementById('error-otpCode'), "Code must be 6 digits.");
            return;
        }

        clearInputError(otpCodeInput, document.getElementById('error-otpCode'));
        verifyOtpBtn.disabled = true;
        verifyOtpBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

        try {
            await confirmationResult.confirm(code);
            showToast("Logged in successfully! Redirecting...", "success");
            
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1500);
        } catch (error) {
            console.error("OTP Verification failed: ", error);
            const friendlyMessage = error.message || error.code || "Verification failed.";
            showInputError(otpCodeInput, document.getElementById('error-otpCode'), friendlyMessage);
            showToast("Verification failed. Please check the code.", "error");
            verifyOtpBtn.disabled = false;
            verifyOtpBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Verify & Confirm';
        }
    }

    function showInputError(field, errorEl, message) {
        field.parentElement.classList.add('invalid');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    function clearInputError(field, errorEl) {
        field.parentElement.classList.remove('invalid');
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    }

    if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleSendOTP();
        });
    }

    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleVerifyOTP();
        });
    }

    if (resendOtpBtn) {
        resendOtpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            otpCodeInput.value = '';
            clearInputError(otpCodeInput, document.getElementById('error-otpCode'));
            phoneStep.classList.remove('hidden');
            otpStep.classList.add('hidden');
        });
    }
});
