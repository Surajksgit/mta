import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
 import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    onSnapshot,
    doc,
    setDoc,
    getDoc,
 } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
 import {
    getAuth,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    onAuthStateChanged,
    signOut,
    updateProfile,
 } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

 // Initialize Firebase with your console configuration
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
const web3FormsAccessKey = "2b41e6e4-56bb-4ef2-b1dd-96f5544cf41b"; // Get your key from https://web3forms.com/

document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication State Variables ---
    let currentUser = null;
    let userProfile = { name: '', email: '' };
    let confirmationResult = null;
    let pendingBookingPayload = null;
    let recaptchaVerifier = null;
    let unsubscribePersonalBookings = null;

    // --- Auth DOM Elements ---
    const userStatus = document.getElementById('userStatus');
    const userPhoneNumber = document.getElementById('userPhoneNumber');
    const logoutBtn = document.getElementById('logoutBtn');
    const headerLoginBtn = document.getElementById('headerLoginBtn');
    const headerReserveBtn = document.getElementById('headerReserveBtn');
    
    const authModal = document.getElementById('authModal');
    const authModalCloseBtn = document.getElementById('authModalCloseBtn');
    const authPhoneInput = document.getElementById('authPhone');
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const recaptchaContainer = document.getElementById('recaptcha-container');
    
    const phoneStep = document.getElementById('phoneStep');
    const otpStep = document.getElementById('otpStep');
    const otpCodeInput = document.getElementById('otpCode');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const resendOtpBtn = document.getElementById('resendOtpBtn');

    // --- Dashboard & Lock DOM Elements ---
    const bookingLock = document.getElementById('bookingLock');
    const lockLoginBtn = document.getElementById('lockLoginBtn');
    const dashboardView = document.getElementById('dashboardView');
    const dashboardWelcomeText = document.getElementById('dashboardWelcomeText');
    const dashboardBookBtn = document.getElementById('dashboardBookBtn');
    const dashboardLogoutBtn = document.getElementById('dashboardLogoutBtn');
    const myBookingsList = document.getElementById('myBookingsList');
    
    const bookingFormCard = document.getElementById('bookingFormCard');
    const bookingBackToDashboardBtn = document.getElementById('bookingBackToDashboardBtn');

    // --- Profile DOM Elements ---
    const profileModal = document.getElementById('profileModal');
    const profileModalCloseBtn = document.getElementById('profileModalCloseBtn');
    const profileNameInput = document.getElementById('profileName');
    const profileEmailInput = document.getElementById('profileEmail');
    const profileForm = document.getElementById('profileForm');
    const dashboardEditProfileBtn = document.getElementById('dashboardEditProfileBtn');

    // --- User Profile Sync Helper ---
    async function fetchAndSyncProfile(user) {
        if (!user) return;
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                userProfile.name = data.name || '';
                userProfile.email = data.email || '';
            } else {
                userProfile.name = '';
                userProfile.email = '';
            }
        } catch (error) {
            console.error("Error fetching user profile from Firestore:", error);
        }
    }

    // --- UI State Helper ---
    function updateUIState(user) {
        if (user) {
            // User is Logged In
            if (headerLoginBtn) headerLoginBtn.classList.add('hidden');
            if (headerReserveBtn) headerReserveBtn.classList.remove('hidden');
            
            const displayGreetingName = userProfile.name || user.displayName || user.phoneNumber;
            
            if (userStatus) {
                userPhoneNumber.textContent = displayGreetingName;
                userStatus.classList.remove('hidden');
            }
            
            if (bookingLock) bookingLock.classList.add('hidden');
            
            // If they aren't actively in the booking form card, show the dashboard
            if (bookingFormCard && bookingFormCard.classList.contains('hidden')) {
                if (dashboardView) {
                    dashboardView.classList.remove('hidden');
                    dashboardWelcomeText.textContent = `Welcome back, ${displayGreetingName}!`;
                }
            }
            
            // Autofill customer inputs
            const phoneInput = document.getElementById('customerPhone');
            if (phoneInput) phoneInput.value = user.phoneNumber;

            const nameInput = document.getElementById('customerName');
            if (nameInput && userProfile.name) {
                nameInput.value = userProfile.name;
            }

            const emailInput = document.getElementById('customerEmail');
            if (emailInput && userProfile.email) {
                emailInput.value = userProfile.email;
            }
        } else {
            // User is Logged Out
            if (headerLoginBtn) headerLoginBtn.classList.remove('hidden');
            if (headerReserveBtn) headerReserveBtn.classList.add('hidden');
            if (userStatus) {
                userPhoneNumber.textContent = '';
                userStatus.classList.add('hidden');
            }
            
            if (bookingLock) bookingLock.classList.remove('hidden');
            if (dashboardView) dashboardView.classList.add('hidden');
            if (bookingFormCard) bookingFormCard.classList.add('hidden');
            
            const phoneInput = document.getElementById('customerPhone');
            if (phoneInput) phoneInput.value = '';

            const nameInput = document.getElementById('customerName');
            if (nameInput) nameInput.value = '';

            const emailInput = document.getElementById('customerEmail');
            if (emailInput) emailInput.value = '';
            
            if (unsubscribePersonalBookings) {
                unsubscribePersonalBookings();
                unsubscribePersonalBookings = null;
            }
        }
    }

    // --- Firebase Authentication Observer ---
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
            updateUIState(null);
        }
    });

    // Handle logout action
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to log out?")) {
                try {
                    await signOut(auth);
                } catch (error) {
                    console.error("Logout failed: ", error);
                }
            }
        });
    }

    // Modal Close actions for Auth Modal
    function closeAuthModal() {
        authModal.classList.add('hidden');
        phoneStep.classList.remove('hidden');
        otpStep.classList.add('hidden');
        otpCodeInput.value = '';
        if (recaptchaVerifier) {
            recaptchaVerifier.clear();
            recaptchaVerifier = null;
        }
    }
    
    if (authModalCloseBtn) authModalCloseBtn.addEventListener('click', closeAuthModal);
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });

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
            phoneStep.classList.remove('hidden');
            otpStep.classList.add('hidden');
        });
    }

    // --- Header and Dashboard Buttons Binding ---
    if (headerLoginBtn) {
        headerLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            authModal.classList.remove('hidden');
        });
    }

    if (lockLoginBtn) {
        lockLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            authModal.classList.remove('hidden');
        });
    }

    if (dashboardBookBtn) {
        dashboardBookBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dashboardView.classList.add('hidden');
            bookingFormCard.classList.remove('hidden');
        });
    }

    if (dashboardLogoutBtn) {
        dashboardLogoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to log out?")) {
                try {
                    await signOut(auth);
                } catch (error) {
                    console.error("Sign out failed: ", error);
                }
            }
        });
    }

    if (bookingBackToDashboardBtn) {
        bookingBackToDashboardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            bookingFormCard.classList.add('hidden');
            dashboardView.classList.remove('hidden');
        });
    }

    // --- Edit Profile Bindings ---
    if (dashboardEditProfileBtn) {
        dashboardEditProfileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (profileNameInput) profileNameInput.value = userProfile.name || '';
            if (profileEmailInput) profileEmailInput.value = userProfile.email || '';
            
            // Clear validation errors
            if (profileNameInput) profileNameInput.parentElement.classList.remove('invalid');
            if (profileEmailInput) profileEmailInput.parentElement.classList.remove('invalid');
            const errName = document.getElementById('error-profileName');
            if (errName) errName.style.display = 'none';
            const errEmail = document.getElementById('error-profileEmail');
            if (errEmail) errEmail.style.display = 'none';
            
            profileModal.classList.remove('hidden');
        });
    }

    if (profileModalCloseBtn) {
        profileModalCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            profileModal.classList.add('hidden');
        });
    }

    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            profileModal.classList.add('hidden');
        }
    });

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
            
            const saveBtn = document.getElementById('saveProfileBtn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            }
            
            try {
                // Update Firestore doc users/{uid}
                const userDocRef = doc(db, "users", currentUser.uid);
                await setDoc(userDocRef, {
                    name: name,
                    email: email,
                    phone: currentUser.phoneNumber,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                
                // Update local profile state
                userProfile.name = name;
                userProfile.email = email;
                
                // Update Auth Profile displayName
                await updateProfile(currentUser, {
                    displayName: name
                });
                
                // Close modal & Update UI welcome greeting
                profileModal.classList.add('hidden');
                updateUIState(currentUser);
                
                // Also update form inputs if visible
                const customerNameInput = document.getElementById('customerName');
                if (customerNameInput) customerNameInput.value = name;
                const customerEmailInput = document.getElementById('customerEmail');
                if (customerEmailInput) customerEmailInput.value = email;
                
            } catch (error) {
                console.error("Failed to save profile: ", error);
                alert("Failed to save profile details. Please try again.");
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Profile Details';
                }
            }
        });
    }

    // --- DOM Elements ---
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    const toggleTransport = document.getElementById('toggleTransport');
    const toggleRental = document.getElementById('toggleRental');
    const dropoffGroup = document.getElementById('dropoffGroup');
    const pickupAddressInput = document.getElementById('pickupAddress');
    const dropoffAddressInput = document.getElementById('dropoffAddress');
    
    const bookingForm = document.getElementById('bookingForm');
    const serviceCategorySelect = document.getElementById('serviceCategory');
    const bookingDateInput = document.getElementById('bookingDate');
    const bookingTimeInput = document.getElementById('bookingTime');
    
    const durationGroup = document.getElementById('durationGroup');
    const durationLabel = document.getElementById('durationLabel');
    const bookingDurationInput = document.getElementById('bookingDuration');
    
    const priceEstimateBox = document.getElementById('priceEstimateBox');
    const priceBaseVal = document.getElementById('priceBaseVal');
    const priceFactorRow = document.getElementById('priceFactorRow');
    const priceFactorLabel = document.getElementById('priceFactorLabel');
    const priceFactorVal = document.getElementById('priceFactorVal');
    const priceTotalVal = document.getElementById('priceTotalVal');
    
    const availabilityStatus = document.getElementById('availabilityStatus');
    const submitBtn = document.getElementById('submitBtn');
    
    const bookingsList = document.getElementById('bookingsList');
    const clearBookingsBtn = document.getElementById('clearBookingsBtn');
    
    const bookingModal = document.getElementById('bookingModal');
    const bookingReceipt = document.getElementById('bookingReceipt');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalOkBtn = document.getElementById('modalOkBtn');

    // --- State Variable ---
    let bookingMode = 'transport'; // 'transport' or 'rental'

    // --- 1. Mobile Menu Toggle ---
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

    // Close menu when clicking a link
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            const icon = menuToggle.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-bars';
            
            // Update active state
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // --- 2. Setup Date Input Constraints ---
    // Prevent booking in the past. Set minimum date to today.
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const formattedToday = `${yyyy}-${mm}-${dd}`;
    bookingDateInput.min = formattedToday;

    // --- 3. Booking Type Toggle & Pricing Estimation Logic ---
    
    // Pricing configuration
    const pricingConfig = {
        rental: {
            baseRate: 199,    // Covers 1st day
            factorRate: 149,  // Per additional day
            factorUnit: 'Day'
        },
        transport: {
            airport: {
                baseRate: 150, // Flat rate
                factorRate: 0,
                factorUnit: 'N/A'
            },
            local: {
                baseRate: 150, // Covers first 2 hours
                factorRate: 75, // Per additional hour
                factorUnit: 'Hour'
            },
            'long-distance': {
                baseRate: 250,  // Covers first 50 miles
                factorRate: 2.50, // Per additional mile
                factorUnit: 'Mile'
            }
        }
    };

    function updatePriceEstimate() {
        let basePrice = 0;
        let factorPrice = 0;
        let totalPrice = 0;
        const duration = parseInt(bookingDurationInput.value) || 0;

        if (bookingMode === 'rental') {
            const config = pricingConfig.rental;
            basePrice = config.baseRate;
            if (duration > 1) {
                factorPrice = (duration - 1) * config.factorRate;
            }
            totalPrice = basePrice + factorPrice;
            
            priceBaseVal.textContent = `$${basePrice.toFixed(2)}`;
            priceFactorRow.classList.remove('hidden');
            priceFactorLabel.innerHTML = `Addtl. Days (at $${config.factorRate}/day):`;
            priceFactorVal.textContent = `$${factorPrice.toFixed(2)}`;
        } else {
            const service = serviceCategorySelect.value;
            if (!service) {
                // Reset display
                priceBaseVal.textContent = "$0.00";
                priceFactorVal.textContent = "$0.00";
                priceTotalVal.textContent = "$0.00";
                return;
            }

            const config = pricingConfig.transport[service];
            basePrice = config.baseRate;

            if (service === 'airport') {
                totalPrice = basePrice;
                priceBaseVal.textContent = `$${basePrice.toFixed(2)}`;
                priceFactorRow.classList.add('hidden');
            } else if (service === 'local') {
                if (duration > 2) {
                    factorPrice = (duration - 2) * config.factorRate;
                }
                totalPrice = basePrice + factorPrice;
                
                priceBaseVal.textContent = `$${basePrice.toFixed(2)} (2 hrs)`;
                priceFactorRow.classList.remove('hidden');
                priceFactorLabel.innerHTML = `Addtl. Hours (at $${config.factorRate}/hr):`;
                priceFactorVal.textContent = `$${factorPrice.toFixed(2)}`;
            } else if (service === 'long-distance') {
                if (duration > 50) {
                    factorPrice = (duration - 50) * config.factorRate;
                }
                totalPrice = basePrice + factorPrice;

                priceBaseVal.textContent = `$${basePrice.toFixed(2)} (50 mi)`;
                priceFactorRow.classList.remove('hidden');
                priceFactorLabel.innerHTML = `Addtl. Miles (at $${config.factorRate.toFixed(2)}/mi):`;
                priceFactorVal.textContent = `$${factorPrice.toFixed(2)}`;
            }
        }

        priceTotalVal.textContent = `$${totalPrice.toFixed(2)}`;
    }

    function handleBookingLayoutChange() {
        if (bookingMode === 'rental') {
            // For solo rental, service type must be local rental
            serviceCategorySelect.value = 'local';
            serviceCategorySelect.setAttribute('disabled', 'disabled');
            
            // Configure duration input for rental days
            durationGroup.classList.remove('hidden-field');
            durationLabel.innerHTML = `<i class="fa-solid fa-calendar-day"></i> Rental Duration (Days)`;
            bookingDurationInput.min = 1;
            if (parseInt(bookingDurationInput.value) < 1 || !bookingDurationInput.value) {
                bookingDurationInput.value = 1;
            }
        } else {
            serviceCategorySelect.removeAttribute('disabled');
            const service = serviceCategorySelect.value;
            
            if (service === 'airport') {
                // Airport transfer is a flat rate, no duration inputs needed
                durationGroup.classList.add('hidden-field');
                bookingDurationInput.value = 1;
            } else if (service === 'local') {
                // Local chauffeur hourly rental
                durationGroup.classList.remove('hidden-field');
                durationLabel.innerHTML = `<i class="fa-solid fa-clock"></i> Chauffeur Hours`;
                bookingDurationInput.min = 2;
                if (parseInt(bookingDurationInput.value) < 2 || !bookingDurationInput.value) {
                    bookingDurationInput.value = 2;
                }
            } else if (service === 'long-distance') {
                // Long distance trips mileage calculator
                durationGroup.classList.remove('hidden-field');
                durationLabel.innerHTML = `<i class="fa-solid fa-road"></i> Est. Distance (Miles)`;
                bookingDurationInput.min = 50;
                if (parseInt(bookingDurationInput.value) < 50 || !bookingDurationInput.value) {
                    bookingDurationInput.value = 100; // default 100 miles
                }
            } else {
                // No service selected yet
                durationGroup.classList.add('hidden-field');
            }
        }
        
        updatePriceEstimate();
    }

    function setBookingMode(mode) {
        bookingMode = mode;
        if (mode === 'transport') {
            toggleTransport.classList.add('active');
            toggleRental.classList.remove('active');
            
            // Show dropoff field
            dropoffGroup.classList.remove('hidden-field');
            dropoffAddressInput.setAttribute('required', 'required');
        } else {
            toggleRental.classList.add('active');
            toggleTransport.classList.remove('active');
            
            // Hide dropoff field
            dropoffGroup.classList.add('hidden-field');
            dropoffAddressInput.removeAttribute('required');
        }
        
        // Clean error styles and update layout
        clearAllValidationErrors();
        handleBookingLayoutChange();
    }

    if (toggleTransport && toggleRental) {
        toggleTransport.addEventListener('click', (e) => {
            e.preventDefault();
            setBookingMode('transport');
        });

        toggleRental.addEventListener('click', (e) => {
            e.preventDefault();
            setBookingMode('rental');
        });
    }

    // Attach listeners to input fields to trigger live pricing updates
    serviceCategorySelect.addEventListener('change', handleBookingLayoutChange);
    bookingDurationInput.addEventListener('input', updatePriceEstimate);

    // --- 4. Live Firestore Database Setup ---
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

            // Sort by date then time
            bookings.sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
                return a.time.localeCompare(b.time);
            });

            myBookingsList.innerHTML = '';
            if (bookings.length === 0) {
                myBookingsList.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-muted">No reservations booked yet. Click "+ Book New Journey" to get started.</td>
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

    // --- 5. Firebase Live Availability APIs ---

    /**
     * Checks if a booking already exists at the chosen Date and Time.
     */
    async function checkSlotAvailability(date, time) {
        try {
            const q = query(
                bookingsCollection, 
                where("date", "==", date), 
                where("time", "==", time)
            );
            const querySnapshot = await getDocs(q);
            // Returns true if the slot is free (no matching document found)
            return querySnapshot.empty;
        } catch (error) {
            console.error("Error checking availability: ", error);
            throw error;
        }
    }

    /**
     * Adds the booking metadata as a document in Firestore
     */
    async function bookSlot(bookingDetails) {
        try {
            const newBooking = {
                ...bookingDetails,
                status: "Confirmed",
                createdAt: new Date().toISOString()
            };
            
            const docRef = await addDoc(bookingsCollection, newBooking);
            
            // Return receipt details to display in the modal
            return {
                id: docRef.id.slice(0, 8).toUpperCase(), // Shortened ID for UI receipt
                ...newBooking
            };
        } catch (error) {
            console.error("Error saving booking: ", error);
            throw error;
        }
    }

    /**
     * Sends an email notification to the administrator containing booking details using Web3Forms.
     */
    async function sendEmailNotification(booking) {
        if (web3FormsAccessKey === "YOUR_WEB3FORMS_ACCESS_KEY") {
            console.warn("Web3Forms access key not set. Email notification skipped.");
            return;
        }

        const modeLabel = booking.mode === 'transport' ? 'Chauffeur Ride' : 'Van Rental';
        const serviceLabel = booking.serviceCategory.charAt(0).toUpperCase() + booking.serviceCategory.slice(1);

        const emailPayload = {
            access_key: web3FormsAccessKey,
            subject: `New Reservation Confirmation - ID: ${booking.id}`,
            from_name: "MTA Travels Reservation System",
            
            // Form fields that will show up in the email:
            "Booking ID": booking.id,
            "Client Name": booking.name,
            "Client Email": booking.email,
            "Client Phone": booking.phone,
            "Booking Type": `${modeLabel} (${serviceLabel})`,
            "Date & Time": `${booking.date} at ${booking.time}`,
            "Pick-up Address": booking.pickup,
            "Drop-off Address": booking.dropoff,
            "Price Quote": booking.price,
            "Submitted At": booking.createdAt
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
                console.log("Email notification sent successfully via Web3Forms.");
            } else {
                console.error("Failed to send email via Web3Forms: ", result.message);
            }
        } catch (error) {
            console.error("Error occurred while sending email: ", error);
        }
    }

    /**
     * Initializes invisible ReCAPTCHA verifier for phone auth
     */
    function initRecaptcha() {
        if (recaptchaVerifier) return;
        
        // Clear DOM element content to reset any internal Google reCAPTCHA state/iframes
        const recaptchaContainer = document.getElementById('recaptcha-container');
        if (recaptchaContainer) recaptchaContainer.innerHTML = '';

        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
                // reCAPTCHA solved
            }
        });
    }

    /**
     * Sends OTP code to user's phone number
     */
    async function handleSendOTP(phoneVal) {
        const rawPhone = phoneVal || authPhoneInput.value.trim();
        if (!rawPhone) {
            validateField(authPhoneInput, document.getElementById('error-authPhone'), false, "Phone number is required.");
            return;
        }

        // Normalize phone number to E.164 format (+1XXXXXXXXXX)
        let phoneNumber = rawPhone.replace(/[^0-9+]/g, ''); // Remove spaces, hyphens, parentheses
        if (!phoneNumber.startsWith('+')) {
            phoneNumber = '+1' + phoneNumber; // Default to US country code if missing
        }

        sendOtpBtn.disabled = true;
        sendOtpBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending SMS...';

        try {
            initRecaptcha();
            confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
            
            // Go to code entry step
            phoneStep.classList.add('hidden');
            otpStep.classList.remove('hidden');
            sendOtpBtn.disabled = false;
            sendOtpBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTP Code';
        } catch (error) {
            console.error("Failed to send SMS: ", error);
            const friendlyMessage = `Failed to send SMS. Reason: ${error.message || error.code || "unknown error"}`;
            validateField(authPhoneInput, document.getElementById('error-authPhone'), false, friendlyMessage);
            sendOtpBtn.disabled = false;
            sendOtpBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTP Code';
            
            if (recaptchaVerifier) {
                recaptchaVerifier.clear();
                recaptchaVerifier = null;
            }
        }
    }

    /**
     * Verifies the OTP code submitted by the user
     */
    async function handleVerifyOTP() {
        const code = otpCodeInput.value.trim();
        if (code.length !== 6) {
            validateField(otpCodeInput, document.getElementById('error-otpCode'), false, "Code must be 6 digits.");
            return;
        }

        verifyOtpBtn.disabled = true;
        verifyOtpBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

        try {
            const result = await confirmationResult.confirm(code);
            currentUser = result.user;
            
            alert("Logged in successfully! Welcome to your dashboard.");
            closeAuthModal();
            
            // If booking was waiting, submit it now!
            if (pendingBookingPayload) {
                await completeBookingSubmit(pendingBookingPayload);
            }
        } catch (error) {
            console.error("OTP Verification failed: ", error);
            const friendlyMessage = `Verification failed. Reason: ${error.message || error.code || "invalid code"}`;
            validateField(otpCodeInput, document.getElementById('error-otpCode'), false, friendlyMessage);
            verifyOtpBtn.disabled = false;
            verifyOtpBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Verify & Confirm Booking';
        }
    }

    /**
     * Complete booking form submission to Firestore & Web3Forms
     */
    async function completeBookingSubmit(payload) {
        try {
            submitBtn.disabled = true;
            availabilityStatus.className = "availability-status available";
            availabilityStatus.innerHTML = `
                <div class="status-indicator"></div>
                <span>Securing Booking...</span>
            `;
            availabilityStatus.classList.remove('hidden');

            // Attach user UID
            const finalPayload = {
                ...payload,
                userId: currentUser ? currentUser.uid : null
            };

            const confirmedBooking = await bookSlot(finalPayload);

            availabilityStatus.classList.add('hidden');
            submitBtn.disabled = false;

            // Trigger Success Modal
            showReceiptModal(confirmedBooking);

            // Send Email Notification
            sendEmailNotification(confirmedBooking);
            
            // Reset form
            bookingForm.reset();
            setBookingMode('transport');
            pendingBookingPayload = null;

            // Redirect back to dashboard
            if (bookingFormCard) bookingFormCard.classList.add('hidden');
            if (dashboardView) dashboardView.classList.remove('hidden');
        } catch (error) {
            console.error("Booking process failure: ", error);
            availabilityStatus.className = "availability-status booked";
            availabilityStatus.innerHTML = `
                <div class="status-indicator"></div>
                <span>Server communication error. Please try again.</span>
            `;
            submitBtn.disabled = false;
        }
    }

    // --- 6. Form Validation & Submission ---

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

    function clearAllValidationErrors() {
        const groups = document.querySelectorAll('.form-group');
        groups.forEach(g => g.classList.remove('invalid'));
        const errors = document.querySelectorAll('.error-message');
        errors.forEach(e => e.style.display = 'none');
    }

    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllValidationErrors();

        // Extract form values
        const serviceCategory = serviceCategorySelect.value;
        const bookingDate = bookingDateInput.value;
        const bookingTime = bookingTimeInput.value;
        const bookingDuration = parseInt(bookingDurationInput.value) || 0;
        const pickupAddress = pickupAddressInput.value.trim();
        const dropoffAddress = dropoffAddressInput.value.trim();
        const customerName = document.getElementById('customerName').value.trim();
        const customerEmail = document.getElementById('customerEmail').value.trim();
        const customerPhone = document.getElementById('customerPhone').value.trim();

        // Validation Flags
        let isValid = true;

        // 1. Service Type Validation
        isValid = validateField(
            serviceCategorySelect,
            document.getElementById('error-serviceCategory'),
            serviceCategory !== "",
            "Please select a service type."
        ) && isValid;

        // 1.5 Duration Validation
        let minDuration = 1;
        let durationErrorMsg = "Please enter a valid duration.";
        let checkDuration = false;

        if (bookingMode === 'rental') {
            checkDuration = true;
            minDuration = 1;
            durationErrorMsg = "Solo Rental requires a minimum of 1 day.";
        } else if (serviceCategory === 'local') {
            checkDuration = true;
            minDuration = 2;
            durationErrorMsg = "Local Chauffeur service requires a minimum of 2 hours.";
        } else if (serviceCategory === 'long-distance') {
            checkDuration = true;
            minDuration = 50;
            durationErrorMsg = "Long distance trip requires a minimum of 50 miles.";
        }

        if (checkDuration) {
            isValid = validateField(
                bookingDurationInput,
                document.getElementById('error-bookingDuration'),
                bookingDuration >= minDuration,
                durationErrorMsg
            ) && isValid;
        }

        // 2. Date Validation (must be selected and not in the past)
        const selectedDate = new Date(bookingDate + 'T00:00:00');
        const todayNoTime = new Date();
        todayNoTime.setHours(0,0,0,0);
        
        isValid = validateField(
            bookingDateInput,
            document.getElementById('error-bookingDate'),
            bookingDate !== "" && selectedDate >= todayNoTime,
            "Please select a valid future date."
        ) && isValid;

        // 3. Time Validation
        isValid = validateField(
            bookingTimeInput,
            document.getElementById('error-bookingTime'),
            bookingTime !== "",
            "Preferred reservation time is required."
        ) && isValid;

        // 4. Pickup Location
        isValid = validateField(
            pickupAddressInput,
            document.getElementById('error-pickupAddress'),
            pickupAddress !== "",
            "Pick-up location address is required."
        ) && isValid;

        // 5. Drop-off Location (Only required in Chauffeur Mode)
        if (bookingMode === 'transport') {
            isValid = validateField(
                dropoffAddressInput,
                document.getElementById('error-dropoffAddress'),
                dropoffAddress !== "",
                "Drop-off location address is required."
            ) && isValid;
        }

        // 6. Name
        isValid = validateField(
            document.getElementById('customerName'),
            document.getElementById('error-customerName'),
            customerName !== "",
            "Full name is required."
        ) && isValid;

        // 7. Email Validation (regex pattern)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        isValid = validateField(
            document.getElementById('customerEmail'),
            document.getElementById('error-customerEmail'),
            emailRegex.test(customerEmail),
            "Please enter a valid email address."
        ) && isValid;

        // 8. Phone Validation (min 10 digits/pattern)
        const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
        isValid = validateField(
            document.getElementById('customerPhone'),
            document.getElementById('error-customerPhone'),
            phoneRegex.test(customerPhone),
            "Please enter a valid 10-digit phone number."
        ) && isValid;

        // If client-side validation fails, stop.
        if (!isValid) return;

        // --- Simulated Backend Availability Checking Phase ---
        submitBtn.disabled = true;
        availabilityStatus.className = "availability-status checking";
        availabilityStatus.innerHTML = `
            <div class="status-indicator"></div>
            <span>Querying Calendar Database...</span>
        `;
        availabilityStatus.classList.remove('hidden');

        try {
            // Call API hook
            const isAvailable = await checkSlotAvailability(bookingDate, bookingTime);

            if (!isAvailable) {
                // Collision Error Handling
                availabilityStatus.className = "availability-status booked";
                availabilityStatus.innerHTML = `
                    <div class="status-indicator"></div>
                    <span>Conflict Error: This slot is already booked. Please pick another time.</span>
                `;
                
                // Highlight Date and Time inputs as invalid
                bookingDateInput.parentElement.classList.add('invalid');
                bookingTimeInput.parentElement.classList.add('invalid');
                
                submitBtn.disabled = false;
                return;
            }

            // Slot is available, proceed to save reservation
            availabilityStatus.className = "availability-status available";
            availabilityStatus.innerHTML = `
                <div class="status-indicator"></div>
                <span>Slot Available! Securing Booking...</span>
            `;

            const bookingPayload = {
                name: customerName,
                email: customerEmail,
                phone: customerPhone,
                mode: bookingMode,
                serviceCategory: serviceCategory,
                date: bookingDate,
                time: bookingTime,
                pickup: pickupAddress,
                dropoff: bookingMode === 'transport' ? dropoffAddress : 'N/A (Solo Rental)',
                price: priceTotalVal.textContent
            };

            // Slot is available, proceed to check authentication
            if (!currentUser) {
                // User is not logged in. Defer slot booking.
                availabilityStatus.classList.add('hidden');
                submitBtn.disabled = false;

                // Stash booking data
                pendingBookingPayload = bookingPayload;
                
                // Show authentication modal and start verification flow
                authPhoneInput.value = customerPhone;
                authModal.classList.remove('hidden');
                handleSendOTP(customerPhone);
                return;
            }

            // Already authenticated, proceed to complete submission
            await completeBookingSubmit(bookingPayload);

        } catch (error) {
            console.error("Booking process failure", error);
            availabilityStatus.className = "availability-status booked";
            availabilityStatus.innerHTML = `
                <div class="status-indicator"></div>
                <span>Server communication error. Please try again.</span>
            `;
            submitBtn.disabled = false;
        }
    });

    // --- 7. Confirmation Modal Actions ---
    function showReceiptModal(booking) {
        const modeLabel = booking.mode === 'transport' ? 'Chauffeur Ride' : 'Van Rental';
        const serviceLabel = booking.serviceCategory.charAt(0).toUpperCase() + booking.serviceCategory.slice(1);
        
        let routeHtml = '';
        if (booking.mode === 'transport') {
            routeHtml = `
                <div class="receipt-row">
                    <span class="receipt-label">Pick-up:</span>
                    <span class="receipt-val">${booking.pickup}</span>
                </div>
                <div class="receipt-row">
                    <span class="receipt-label">Drop-off:</span>
                    <span class="receipt-val">${booking.dropoff}</span>
                </div>
            `;
        } else {
            routeHtml = `
                <div class="receipt-row">
                    <span class="receipt-label">Pick-up Location:</span>
                    <span class="receipt-val">${booking.pickup}</span>
                </div>
            `;
        }

        bookingReceipt.innerHTML = `
            <div class="receipt-row">
                <span class="receipt-label">Reservation ID:</span>
                <span class="receipt-val" style="color: var(--accent-blue); font-weight: 700;">${booking.id}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Customer Name:</span>
                <span class="receipt-val">${booking.name}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Booking Mode:</span>
                <span class="receipt-val">${modeLabel} (${serviceLabel})</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Date & Time:</span>
                <span class="receipt-val">${booking.date} at ${booking.time}</span>
            </div>
            ${routeHtml}
            <div class="receipt-row" style="border-top: 1px solid var(--border-color); padding-top: 0.8rem; margin-top: 0.4rem;">
                <span class="receipt-label">Amount (Simulated):</span>
                <span class="receipt-val" style="color: var(--accent-blue); font-weight: 700;">${booking.price}</span>
            </div>
            <div class="receipt-row">
                <span class="receipt-label">Status:</span>
                <span class="receipt-val" style="color: var(--success); font-weight: 700;">CONFIRMED</span>
            </div>
        `;

        bookingModal.classList.remove('hidden');
    }

    function closeModal() {
        bookingModal.classList.add('hidden');
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalOkBtn) modalOkBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking on dark backdrop
    bookingModal.addEventListener('click', (e) => {
        if (e.target === bookingModal) closeModal();
    });

    // --- 8. Initial Execution ---
    setBookingMode('transport'); // Set initial layout and calculate initial price
});
