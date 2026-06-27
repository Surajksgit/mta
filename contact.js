import { auth, db } from "./firebase-config.js";
import {
   doc,
   getDoc,
   setDoc,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
   onAuthStateChanged,
   signOut,
   updateProfile,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const web3FormsAccessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY;

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
    // DOM Elements
    const userStatus = document.getElementById('userStatus');
    const userPhoneNumber = document.getElementById('userPhoneNumber');
    const logoutBtn = document.getElementById('logoutBtn');
    const headerLoginBtn = document.getElementById('headerLoginBtn');
    const headerReserveBtn = document.getElementById('headerReserveBtn');
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');

    let currentUser = null;
    let userProfile = { name: '', email: '' };

    async function fetchAndSyncProfile(user) {
        if (!user) return;
        try {
            const cached = localStorage.getItem(`mta_user_profile_${user.uid}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                userProfile.name = parsed.name || '';
                userProfile.email = parsed.email || '';
            }

            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                userProfile.name = data.name || userProfile.name;
                userProfile.email = data.email || userProfile.email;
                localStorage.setItem(`mta_user_profile_${user.uid}`, JSON.stringify(userProfile));
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            const cached = localStorage.getItem(`mta_user_profile_${user.uid}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                userProfile.name = parsed.name || '';
                userProfile.email = parsed.email || '';
            }
        }
    }

    const contactForm = document.getElementById('contactForm');
    const contactNameInput = document.getElementById('contactName');
    const contactEmailInput = document.getElementById('contactEmail');
    const contactPhoneInput = document.getElementById('contactPhone');
    const contactSubjectSelect = document.getElementById('contactSubject');
    const contactMessageInput = document.getElementById('contactMessage');
    const sendContactBtn = document.getElementById('sendContactBtn');

    // Header Authentication state management
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await fetchAndSyncProfile(user);
            
            const displayGreetingName = userProfile.name || user.displayName || user.phoneNumber;
            if (userPhoneNumber) {
                userPhoneNumber.textContent = displayGreetingName;
            }
            if (userStatus) userStatus.classList.remove('hidden');
            if (headerLoginBtn) headerLoginBtn.classList.add('hidden');
            if (headerReserveBtn) headerReserveBtn.classList.remove('hidden');

            // Prefill contact form if logged in and empty
            if (contactNameInput && !contactNameInput.value) {
                contactNameInput.value = userProfile.name || "";
            }
            if (contactEmailInput && !contactEmailInput.value) {
                contactEmailInput.value = userProfile.email || "";
            }
            if (contactPhoneInput && !contactPhoneInput.value) {
                contactPhoneInput.value = user.phoneNumber || "";
            }

            setupProfileModalLogic(user);
        } else {
            currentUser = null;
            userProfile.name = '';
            userProfile.email = '';
            if (userStatus) userStatus.classList.add('hidden');
            if (headerLoginBtn) headerLoginBtn.classList.remove('hidden');
            if (headerReserveBtn) headerReserveBtn.classList.add('hidden');
        }
    });

    // Handle header logout action
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to log out?")) {
                try {
                    await signOut(auth);
                    showToast("Logged out successfully.", "success");
                } catch (error) {
                    console.error("Logout failed: ", error);
                    showToast("Logout failed. Please try again.", "error");
                }
            }
        });
    }

    // Mobile Navigation Menu Toggle
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            if (navMenu.classList.contains('active')) {
                icon.className = 'fa-solid fa-xmark';
            } else {
                icon.className = 'fa-solid fa-bars';
            }
        });
    }

    // Form validation helpers
    function validateField(field, errorEl, condition, validationMessage) {
        if (!condition) {
            field.parentElement.classList.add('invalid');
            if (errorEl) {
                errorEl.textContent = validationMessage;
                errorEl.style.display = 'block';
            }
            return false;
        } else {
            field.parentElement.classList.remove('invalid');
            if (errorEl) {
                errorEl.style.display = 'none';
            }
            return true;
        }
    }

    // Handle form submit
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = contactNameInput.value.trim();
            const email = contactEmailInput.value.trim();
            const phone = contactPhoneInput.value.trim();
            const subject = contactSubjectSelect.value;
            const message = contactMessageInput.value.trim();

            let isValid = true;

            isValid = validateField(
                contactNameInput,
                document.getElementById('error-contactName'),
                name !== "",
                "Full name is required."
            ) && isValid;

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            isValid = validateField(
                contactEmailInput,
                document.getElementById('error-contactEmail'),
                emailRegex.test(email),
                "Please enter a valid email address."
            ) && isValid;

            isValid = validateField(
                contactPhoneInput,
                document.getElementById('error-contactPhone'),
                phone !== "",
                "Phone number is required."
            ) && isValid;

            isValid = validateField(
                contactSubjectSelect,
                document.getElementById('error-contactSubject'),
                subject !== "",
                "Please select a subject."
            ) && isValid;

            isValid = validateField(
                contactMessageInput,
                document.getElementById('error-contactMessage'),
                message !== "",
                "Message content is required."
            ) && isValid;

            if (!isValid) return;

            // Show Loading Spinner state
            if (sendContactBtn) {
                sendContactBtn.disabled = true;
                sendContactBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending message...';
            }

            if (!web3FormsAccessKey || web3FormsAccessKey === "YOUR_WEB3FORMS_ACCESS_KEY") {
                showToast("Contact form configuration is incomplete. Key not set.", "error");
                if (sendContactBtn) {
                    sendContactBtn.disabled = false;
                    sendContactBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Message';
                }
                return;
            }

            const emailPayload = {
                access_key: web3FormsAccessKey,
                subject: `MTA Travels Contact Form: ${subject}`,
                from_name: name,
                "Client Name": name,
                "Client Email": email,
                "Client Phone": phone,
                "Subject Topic": subject,
                "Message Body": message,
                "Submitted At": new Date().toLocaleString()
            };

            try {
                const response = await fetch("https://api.web3forms.com/submit", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(emailPayload)
                });
                
                const result = await response.json();
                if (result.success) {
                    showToast("Your message was sent successfully. We'll reply soon!", "success");
                    contactForm.reset();
                } else {
                    console.error("Web3Forms error:", result);
                    showToast("Failed to send message. Please try again.", "error");
                }
            } catch (error) {
                console.error("Contact Form fetch error:", error);
                showToast("Connection error. Please check your internet and try again.", "error");
            } finally {
                if (sendContactBtn) {
                    sendContactBtn.disabled = false;
                    sendContactBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Message';
                }
            }
        });
    }

    // Dynamically inject the profile edit modal HTML to the page body
    function injectProfileModal() {
        if (document.getElementById('profileModal')) return;
        const modalHtml = `
            <div id="profileModal" class="modal-overlay hidden">
                <div class="modal-card">
                    <button id="closeProfileModal" class="modal-close">&times;</button>
                    <div class="modal-icon" style="background-color: rgba(59, 130, 246, 0.1); color: var(--accent-blue); display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 1rem auto; font-size: 1.8rem;">
                        <i class="fa-solid fa-circle-user"></i>
                    </div>
                    <h3 class="modal-title">Edit Profile Details</h3>
                    <p class="modal-desc">Update your name and email to automatically customize future ride reservations.</p>
                    
                    <form id="profileModalForm" class="booking-form" style="margin-top: 1.5rem;">
                        <div class="form-group margin-bottom-md" style="text-align: left;">
                            <label for="profileModalName" style="display: block; margin-bottom: 0.5rem; font-weight: 600;"><i class="fa-solid fa-user"></i> Full Name</label>
                            <input type="text" id="profileModalName" placeholder="Your full name" required style="width: 100%; padding: 0.85rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); font-family: var(--font-body); background-color: var(--bg-light); color: var(--text-primary);">
                        </div>
                        <div class="form-group margin-bottom-md" style="text-align: left;">
                            <label for="profileModalEmail" style="display: block; margin-bottom: 0.5rem; font-weight: 600;"><i class="fa-solid fa-envelope"></i> Email Address</label>
                            <input type="email" id="profileModalEmail" placeholder="Your email address" required style="width: 100%; padding: 0.85rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); font-family: var(--font-body); background-color: var(--bg-light); color: var(--text-primary);">
                        </div>
                        <button type="submit" id="btnSaveProfileModal" class="btn btn-primary btn-block" style="margin-top: 1.5rem; width: 100%;">Save Changes</button>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Bind event handlers and logic for the profile edit modal
    function setupProfileModalLogic(user) {
        injectProfileModal();
        
        const profileEditBtn = document.getElementById('profileEditBtn');
        const profileModal = document.getElementById('profileModal');
        const closeProfileModal = document.getElementById('closeProfileModal');
        const profileModalForm = document.getElementById('profileModalForm');
        const profileModalName = document.getElementById('profileModalName');
        const profileModalEmail = document.getElementById('profileModalEmail');
        const btnSaveProfileModal = document.getElementById('btnSaveProfileModal');
        
        if (profileEditBtn) {
            profileEditBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (profileModalName) profileModalName.value = userProfile.name || "";
                if (profileModalEmail) profileModalEmail.value = userProfile.email || "";
                if (profileModal) profileModal.classList.remove('hidden');
            });
        }
        
        if (closeProfileModal) {
            closeProfileModal.addEventListener('click', () => {
                if (profileModal) profileModal.classList.add('hidden');
            });
        }
        
        if (profileModalForm) {
            profileModalForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = profileModalName.value.trim();
                const email = profileModalEmail.value.trim();
                
                if (!name || !email) {
                    showToast("Please fill in all fields.", "error");
                    return;
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    showToast("Please enter a valid email address.", "error");
                    return;
                }
                
                if (btnSaveProfileModal) {
                    btnSaveProfileModal.disabled = true;
                    btnSaveProfileModal.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
                }
                
                const profileData = {
                    name: name,
                    email: email,
                    phone: user.phoneNumber,
                    updatedAt: new Date().toISOString()
                };
                
                try {
                    // Save to Firestore users/{uid}
                    const userDocRef = doc(db, "users", user.uid);
                    await setDoc(userDocRef, profileData, { merge: true });
                    
                    // Update cache state
                    userProfile.name = name;
                    userProfile.email = email;
                    localStorage.setItem(`mta_user_profile_${user.uid}`, JSON.stringify(userProfile));
                    
                    // Update Auth display name in background
                    try {
                        await updateProfile(user, { displayName: name });
                    } catch (authError) {
                        console.warn("Firebase Auth display name update warning: ", authError);
                    }
                    
                    showToast("Profile details updated successfully.", "success");
                    if (profileModal) profileModal.classList.add('hidden');
                    
                    // Refresh greeting headers and prefill active contact form inputs
                    const displayGreetingName = userProfile.name || user.displayName || user.phoneNumber;
                    if (userPhoneNumber) {
                        userPhoneNumber.textContent = displayGreetingName;
                    }
                } catch (error) {
                    console.error("Failed to save profile modal data:", error);
                    showToast("Failed to save changes. Please try again.", "error");
                } finally {
                    if (btnSaveProfileModal) {
                        btnSaveProfileModal.disabled = false;
                        btnSaveProfileModal.innerHTML = 'Save Changes';
                    }
                }
            });
        }
    }
});
