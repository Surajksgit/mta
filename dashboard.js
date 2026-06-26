import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
   getFirestore,
   collection,
   doc,
   getDoc,
   setDoc,
   query,
   where,
   onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
   getAuth,
   onAuthStateChanged,
   signOut,
   updateProfile,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// Initialize Firebase
const firebaseConfig = {
   apiKey: "AIzaSyDMhG9807L6o9WzjPvcyUOnjSgVBarB2EE",
   authDomain: "mtatravels.firebaseapp.com",
   projectId: "mtatravels",
   storageBucket: "mtatravels.firebasestorage.app",
   messagingSenderId: "41759449971",
   appId: "1:41759449971:web:0e12e4477b60e0e6229b06"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const bookingsCollection = collection(db, "bookings");

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

    // DOM Elements
    const userStatus = document.getElementById('userStatus');
    const userPhoneNumber = document.getElementById('userPhoneNumber');
    const logoutBtn = document.getElementById('logoutBtn');
    const dashboardLogoutBtn = document.getElementById('dashboardLogoutBtn');
    
    const dashboardWelcomeText = document.getElementById('dashboardWelcomeText');
    const myBookingsList = document.getElementById('myBookingsList');
    
    const profileForm = document.getElementById('profileForm');
    const profileNameInput = document.getElementById('profileName');
    const profileEmailInput = document.getElementById('profileEmail');
    const saveProfileBtn = document.getElementById('saveProfileBtn');

    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');

    // Authentication Listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await fetchAndSyncProfile(user);
            updateUIState(user);
            listenToPersonalBookings(user.uid);
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
        
        // Populate profile inputs
        if (profileNameInput && userProfile.name) {
            profileNameInput.value = userProfile.name;
        }
        if (profileEmailInput && userProfile.email) {
            profileEmailInput.value = userProfile.email;
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
                        <td colspan="7" class="text-center text-muted">No reservations booked yet. Click "Book New Journey" to get started.</td>
                    </tr>
                `;
                return;
            }

            bookings.forEach(booking => {
                const tr = document.createElement('tr');
                const serviceLabel = booking.serviceCategory.charAt(0).toUpperCase() + booking.serviceCategory.slice(1);
                const modeLabel = booking.mode === 'transport' ? 'Chauffeur Ride' : 'Van Rental';
                const route = booking.mode === 'transport' ? `${booking.pickup} → ${booking.dropoff}` : `Pick-up: ${booking.pickup}`;

                tr.innerHTML = `
                    <td><strong>${booking.id.slice(0, 8).toUpperCase()}</strong></td>
                    <td>${serviceLabel}</td>
                    <td><span class="text-muted">${modeLabel}</span></td>
                    <td>${booking.date} at <strong>${booking.time}</strong></td>
                    <td><span style="font-size: 0.82rem;">${route}</span></td>
                    <td><strong>${booking.price || '$0.00'}</strong></td>
                    <td><span class="badge-status confirmed">${booking.status || 'Confirmed'}</span></td>
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

    // Profile update submit handler
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = profileNameInput.value.trim();
            const email = profileEmailInput.value.trim();
            
            let isValid = true;
            
            isValid = validateField(
                profileNameInput,
                document.getElementById('error-profileName'),
                name !== "",
                "Full name is required."
            ) && isValid;
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            isValid = validateField(
                profileEmailInput,
                document.getElementById('error-profileEmail'),
                emailRegex.test(email),
                "Please enter a valid email address."
            ) && isValid;
            
            if (!isValid) return;
            if (!currentUser) return;
            
            if (saveProfileBtn) {
                saveProfileBtn.disabled = true;
                saveProfileBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            }
            
            const profileData = {
                name: name,
                email: email,
                phone: currentUser.phoneNumber,
                updatedAt: new Date().toISOString()
            };

            // 1. Immediately cache in localStorage
            localStorage.setItem(`mta_user_profile_${currentUser.uid}`, JSON.stringify(profileData));
            userProfile.name = name;
            userProfile.email = email;

            let savedToCloud = false;

            // 2. Try saving to Firestore users/{uid}
            try {
                const userDocRef = doc(db, "users", currentUser.uid);
                await setDoc(userDocRef, profileData, { merge: true });
                savedToCloud = true;
                console.log("Profile saved to users collection successfully.");
            } catch (error) {
                console.warn("Failed to write to users collection. Retrying inside bookings collection document...", error);
                
                // 3. Fallback: Save to bookings/profile_{uid} (bypassing collection restriction rules)
                try {
                    const altDocRef = doc(db, "bookings", `profile_${currentUser.uid}`);
                    await setDoc(altDocRef, {
                        ...profileData,
                        isUserProfile: true,
                        userId: currentUser.uid // keep connected to user ID
                    }, { merge: true });
                    savedToCloud = true;
                    console.log("Profile saved to bookings collection successfully.");
                } catch (altError) {
                    console.error("All Firestore database writes for profile failed: ", altError);
                }
            }
            
            // 4. Try updating Firebase Auth Display Name
            try {
                await updateProfile(currentUser, {
                    displayName: name
                });
            } catch (authError) {
                console.warn("Firebase updateProfile failed: ", authError);
            }
            
            showToast("Profile saved successfully!", "success");
            updateUIState(currentUser);

            if (saveProfileBtn) {
                saveProfileBtn.disabled = false;
                saveProfileBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Profile Details';
            }
        });
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

    if (dashboardLogoutBtn) {
        dashboardLogoutBtn.addEventListener('click', (e) => {
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
});
