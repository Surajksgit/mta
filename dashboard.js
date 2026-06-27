import { auth, db } from "./firebase-config.js";
import {
   collection,
   doc,
   getDoc,
   setDoc,
   query,
   where,
   onSnapshot,
   deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
   onAuthStateChanged,
   signOut,
   updateProfile,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
const bookingsCollection = collection(db, "bookings");
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
    let currentUser = null;
    let userProfile = { name: '', email: '' };
    let unsubscribePersonalBookings = null;
    let localBookingsList = [];

    // DOM Elements
    const userStatus = document.getElementById('userStatus');
    const userPhoneNumber = document.getElementById('userPhoneNumber');
    const logoutBtn = document.getElementById('logoutBtn');

    const dashboardWelcomeText = document.getElementById('dashboardWelcomeText');
    const myBookingsList = document.getElementById('myBookingsList');
    
    // Cancel Booking Modal Elements
    const cancelModal = document.getElementById('cancelModal');
    const closeCancelModal = document.getElementById('closeCancelModal');
    const cancelForm = document.getElementById('cancelForm');
    const cancelBookingIdInput = document.getElementById('cancelBookingId');
    const cancelReasonSelect = document.getElementById('cancelReason');
    const otherReasonContainer = document.getElementById('otherReasonContainer');
    const otherReasonTextInput = document.getElementById('otherReasonText');
    const btnAbortCancel = document.getElementById('btnAbortCancel');
    


    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');

    // Authentication Listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await fetchAndSyncProfile(user);
            updateUIState(user);
            listenToPersonalBookings(user.uid);
            setupProfileModalLogic(user);
        } else {
            currentUser = null;
            userProfile.name = '';
            userProfile.email = '';
            // If logged out, redirect to login page
            window.location.href = "login.html";
        }
    });

    async function fetchAndSyncProfile(user) {
        try {
            // Check localStorage cache first
            const cached = localStorage.getItem(`mta_user_profile_${user.uid}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                userProfile.name = parsed.name || '';
                userProfile.email = parsed.email || '';
            }

            // Attempt to load from users/{uid}
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                userProfile.name = data.name || userProfile.name;
                userProfile.email = data.email || userProfile.email;
                localStorage.setItem(`mta_user_profile_${user.uid}`, JSON.stringify(userProfile));
                return;
            }

            // Fallback: Check bookings/profile_{uid}
            const altDocRef = doc(db, "bookings", `profile_${user.uid}`);
            const altDocSnap = await getDoc(altDocRef);
            if (altDocSnap.exists()) {
                const data = altDocSnap.data();
                userProfile.name = data.name || userProfile.name;
                userProfile.email = data.email || userProfile.email;
                localStorage.setItem(`mta_user_profile_${user.uid}`, JSON.stringify(userProfile));
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            // On failure (rules block), verify if we have cached details in localStorage
            const cached = localStorage.getItem(`mta_user_profile_${user.uid}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                userProfile.name = parsed.name || '';
                userProfile.email = parsed.email || '';
            }
        }
    }

    function updateUIState(user) {
        const displayGreetingName = userProfile.name || user.displayName || user.phoneNumber;
        
        if (userStatus) {
            userPhoneNumber.textContent = displayGreetingName;
            userStatus.classList.remove('hidden');
        }
        
        if (dashboardWelcomeText) {
            dashboardWelcomeText.textContent = `Welcome back, ${displayGreetingName}!`;
        }
        


        // Update minimalist dashboard profile status card
        const statsProfileStatus = document.getElementById('statsProfileStatus');
        if (statsProfileStatus) {
            const isProfileComplete = userProfile.name && userProfile.email;
            statsProfileStatus.textContent = isProfileComplete ? "Complete" : "Incomplete";
            statsProfileStatus.style.color = isProfileComplete ? "var(--success)" : "#d97706";
        }
    }

    function listenToPersonalBookings(userId) {
        if (unsubscribePersonalBookings) {
            unsubscribePersonalBookings();
        }

        const q = query(
            bookingsCollection,
            where("userId", "==", userId)
        );

        unsubscribePersonalBookings = onSnapshot(q, (snapshot) => {
            const bookings = [];
            snapshot.forEach((doc) => {
                bookings.push({ id: doc.id, ...doc.data() });
            });

            // Filter out profile documents from the bookings listing
            const filteredBookings = bookings.filter(b => !b.id.toLowerCase().startsWith('profile_'));
            
            // Cache locally for cancellation details
            localBookingsList = filteredBookings;

            // Calculate and display dynamic stats
            let activeTripsCount = 0;
            let totalSpent = 0;
            
            filteredBookings.forEach(booking => {
                const status = (booking.status || 'Confirmed').toLowerCase();
                if (status !== 'cancelled') {
                    activeTripsCount++;
                    if (booking.price) {
                        const priceNum = parseFloat(booking.price.replace(/[^0-9.]/g, '')) || 0;
                        totalSpent += priceNum;
                    }
                }
            });
            
            const statsActiveTrips = document.getElementById('statsActiveTrips');
            const statsTotalSpent = document.getElementById('statsTotalSpent');
            
            if (statsActiveTrips) {
                statsActiveTrips.textContent = activeTripsCount;
            }
            if (statsTotalSpent) {
                statsTotalSpent.textContent = `$${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }

            // Sort by date then time
            filteredBookings.sort((a, b) => {
                if (a.date && b.date) {
                    const dateCompare = a.date.localeCompare(b.date);
                    if (dateCompare !== 0) return dateCompare;
                }
                if (a.time && b.time) {
                    return a.time.localeCompare(b.time);
                }
                return 0;
            });

            myBookingsList.innerHTML = '';
            if (filteredBookings.length === 0) {
                myBookingsList.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center text-muted">No reservations booked yet. Click "Book New Journey" to get started.</td>
                    </tr>
                `;
                return;
            }

            filteredBookings.forEach(booking => {
                const tr = document.createElement('tr');
                const serviceLabel = booking.serviceCategory.charAt(0).toUpperCase() + booking.serviceCategory.slice(1);
                const modeLabel = booking.mode === 'transport' ? 'Chauffeur Ride' : 'Van Rental';
                const route = booking.mode === 'transport' ? `${booking.pickup} → ${booking.dropoff}` : `Pick-up: ${booking.pickup}`;
                const status = booking.status || 'Confirmed';
                const statusClass = status.toLowerCase() === 'confirmed' ? 'confirmed' : (status.toLowerCase() === 'pending' ? 'pending' : 'cancelled');

                const actionHtml = status.toLowerCase() !== 'cancelled'
                    ? `<td><button class="btn btn-xs btn-outline-danger cancel-booking-trigger-btn" data-id="${booking.id}"><i class="fa-solid fa-ban"></i> Cancel</button></td>`
                    : `<td><span class="text-muted" style="font-size: 0.82rem;"><i class="fa-solid fa-circle-minus"></i> N/A</span></td>`;

                tr.innerHTML = `
                    <td><strong>${booking.id.slice(0, 8).toUpperCase()}</strong></td>
                    <td>${serviceLabel}</td>
                    <td><span class="text-muted">${modeLabel}</span></td>
                    <td>${booking.date} at <strong>${booking.time}</strong></td>
                    <td><span style="font-size: 0.82rem;">${route}</span></td>
                    <td><strong>${booking.price || '$0.00'}</strong></td>
                    <td><span class="badge-status ${statusClass}">${status}</span></td>
                    ${actionHtml}
                `;
                myBookingsList.appendChild(tr);
            });
        }, (error) => {
            console.error("Failed to load personal bookings: ", error);
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
                    
                    // Refresh dashboard stats and greeting headers
                    updateUIState(user);
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

    // Handle logout action
    async function handleLogout() {
        if (confirm("Are you sure you want to log out?")) {
            try {
                await signOut(auth);
                showToast("Logged out successfully. Redirecting...", "success");
                setTimeout(() => {
                    window.location.href = "index.html";
                }, 1500);
            } catch (error) {
                console.error("Logout failed: ", error);
                showToast("Logout failed. Please try again.", "error");
            }
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }



    // Mobile Menu Toggle
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

    // Booking Cancellation Modal Event Handlers
    function openCancellationModal(bookingId) {
        if (cancelBookingIdInput) {
            cancelBookingIdInput.value = bookingId;
        }
        if (cancelReasonSelect) {
            cancelReasonSelect.value = "";
        }
        if (otherReasonContainer) {
            otherReasonContainer.classList.add('hidden');
        }
        if (otherReasonTextInput) {
            otherReasonTextInput.value = "";
            otherReasonTextInput.required = false;
        }
        if (cancelModal) {
            cancelModal.classList.remove('hidden');
        }
    }

    function closeCancellationModal() {
        if (cancelModal) {
            cancelModal.classList.add('hidden');
        }
    }

    if (closeCancelModal) {
        closeCancelModal.addEventListener('click', closeCancellationModal);
    }
    if (btnAbortCancel) {
        btnAbortCancel.addEventListener('click', closeCancellationModal);
    }

    if (cancelReasonSelect && otherReasonContainer) {
        cancelReasonSelect.addEventListener('change', () => {
            if (cancelReasonSelect.value === 'Other') {
                otherReasonContainer.classList.remove('hidden');
                if (otherReasonTextInput) otherReasonTextInput.required = true;
            } else {
                otherReasonContainer.classList.add('hidden');
                if (otherReasonTextInput) {
                    otherReasonTextInput.required = false;
                    otherReasonTextInput.value = "";
                }
            }
        });
    }

    if (myBookingsList) {
        myBookingsList.addEventListener('click', (e) => {
            const triggerBtn = e.target.closest('.cancel-booking-trigger-btn');
            if (triggerBtn) {
                const bookingId = triggerBtn.getAttribute('data-id');
                openCancellationModal(bookingId);
            }
        });
    }

    if (cancelForm) {
        cancelForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const bookingId = cancelBookingIdInput.value;
            let reason = cancelReasonSelect.value;
            if (reason === 'Other' && otherReasonTextInput) {
                reason = otherReasonTextInput.value.trim() || 'Other reason';
            }

            const confirmBtn = document.getElementById('btnConfirmCancel');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Canceling...';
            }

            try {
                // Update Cloud Firestore
                const bookingDocRef = doc(db, "bookings", bookingId);
                await setDoc(bookingDocRef, {
                    status: 'Cancelled',
                    cancelReason: reason,
                    cancelledAt: new Date().toISOString()
                }, { merge: true });

                // Find the booking object locally and remove booked slot registration
                const bookingObj = localBookingsList.find(b => b.id === bookingId);
                if (bookingObj) {
                    const slotId = `${bookingObj.date}_${bookingObj.time.replace(':', '-')}`;
                    const slotDocRef = doc(db, "booked_slots", slotId);
                    await deleteDoc(slotDocRef);
                }

                // Dispatch Email Notification via Web3Forms
                if (bookingObj) {
                    await sendCancellationEmail(bookingObj, reason);
                }

                showToast("Your reservation has been canceled.", "success");
                closeCancellationModal();
            } catch (error) {
                console.error("Booking cancellation failed: ", error);
                showToast("Failed to cancel reservation. Please try again.", "error");
            } finally {
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = 'Confirm Cancel';
                }
            }
        });
    }

    // Dispatch Cancellation Confirmation Email via Web3Forms API
    async function sendCancellationEmail(booking, reason) {
        if (!web3FormsAccessKey || web3FormsAccessKey === "YOUR_WEB3FORMS_ACCESS_KEY") {
            console.warn("Web3Forms access key not set. Cancellation email skipped.");
            return;
        }

        const modeLabel = booking.mode === 'transport' ? 'Chauffeur Ride' : 'Van Rental';
        const serviceLabel = booking.serviceCategory.charAt(0).toUpperCase() + booking.serviceCategory.slice(1);

        const emailPayload = {
            access_key: web3FormsAccessKey,
            subject: `Ride CANCELED - Reservation ID: ${booking.id.slice(0, 8).toUpperCase()}`,
            from_name: "MTA Travels Reservation System",
            "Booking ID": booking.id,
            "Client Name": userProfile.name || booking.name || "Customer",
            "Client Email": userProfile.email || booking.email,
            "Client Phone": booking.phone,
            "Booking Type": `${modeLabel} (${serviceLabel})`,
            "Original Date & Time": `${booking.date} at ${booking.time}`,
            "Status Update": "Your Ride has been canceled",
            "Reason for Cancellation": reason,
            "Cancelled At": new Date().toLocaleString()
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
                console.log("Cancellation email sent successfully.");
            } else {
                console.error("Web3Forms error submitting cancellation email: ", result);
            }
        } catch (error) {
            console.error("Failed to send Web3Forms cancellation email: ", error);
        }
    }
});
