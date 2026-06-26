import { auth, db } from "./firebase-config.js";
import {
   collection,
   addDoc,
   getDocs,
   query,
   where,
   doc,
   getDoc,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
   onAuthStateChanged,
   signOut,
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
    // --- Authentication State Variables ---
    let currentUser = null;
    let userProfile = { name: '', email: '' };

    // --- Auth DOM Elements ---
    const userStatus = document.getElementById('userStatus');
    const userPhoneNumber = document.getElementById('userPhoneNumber');
    const logoutBtn = document.getElementById('logoutBtn');
    const headerLoginBtn = document.getElementById('headerLoginBtn');
    const headerReserveBtn = document.getElementById('headerReserveBtn');
    
    // --- Dashboard & Lock DOM Elements ---
    const bookingLock = document.getElementById('bookingLock');
    const bookingFormCard = document.getElementById('bookingFormCard');

    // --- User Profile Sync Helper ---
    async function fetchAndSyncProfile(user) {
        if (!user) return;
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
            // On failure, check if we have cached details in localStorage
            const cached = localStorage.getItem(`mta_user_profile_${user.uid}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                userProfile.name = parsed.name || '';
                userProfile.email = parsed.email || '';
            }
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
            if (bookingFormCard) bookingFormCard.classList.remove('hidden');
            
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
            if (bookingFormCard) bookingFormCard.classList.add('hidden');
            
            const phoneInput = document.getElementById('customerPhone');
            if (phoneInput) phoneInput.value = '';

            const nameInput = document.getElementById('customerName');
            if (nameInput) nameInput.value = '';

            const emailInput = document.getElementById('customerEmail');
            if (emailInput) emailInput.value = '';
        }
    }

    // --- Firebase Authentication Observer ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await fetchAndSyncProfile(user);
            updateUIState(user);
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
                    showToast("Logged out successfully. Redirecting...", "success");
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } catch (error) {
                    console.error("Logout failed: ", error);
                    showToast("Logout failed.", "error");
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
    
    const priceBaseVal = document.getElementById('priceBaseVal');
    const priceFactorRow = document.getElementById('priceFactorRow');
    const priceFactorLabel = document.getElementById('priceFactorLabel');
    const priceFactorVal = document.getElementById('priceFactorVal');
    const priceTotalVal = document.getElementById('priceTotalVal');
    
    const availabilityStatus = document.getElementById('availabilityStatus');
    const submitBtn = document.getElementById('submitBtn');
    
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
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const formattedToday = `${yyyy}-${mm}-${dd}`;
    if (bookingDateInput) bookingDateInput.min = formattedToday;

    // --- 3. Booking Type Toggle & Pricing Estimation Logic ---
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
        if (!bookingDurationInput) return;
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
            
            if (priceBaseVal) priceBaseVal.textContent = `$${basePrice.toFixed(2)}`;
            if (priceFactorRow) priceFactorRow.classList.remove('hidden');
            if (priceFactorLabel) priceFactorLabel.innerHTML = `Addtl. Days (at $${config.factorRate}/day):`;
            if (priceFactorVal) priceFactorVal.textContent = `$${factorPrice.toFixed(2)}`;
        } else {
            const service = serviceCategorySelect.value;
            if (!service) {
                if (priceBaseVal) priceBaseVal.textContent = "$0.00";
                if (priceFactorVal) priceFactorVal.textContent = "$0.00";
                if (priceTotalVal) priceTotalVal.textContent = "$0.00";
                return;
            }

            const config = pricingConfig.transport[service];
            basePrice = config.baseRate;

            if (service === 'airport') {
                totalPrice = basePrice;
                if (priceBaseVal) priceBaseVal.textContent = `$${basePrice.toFixed(2)}`;
                if (priceFactorRow) priceFactorRow.classList.add('hidden');
            } else if (service === 'local') {
                if (duration > 2) {
                    factorPrice = (duration - 2) * config.factorRate;
                }
                totalPrice = basePrice + factorPrice;
                
                if (priceBaseVal) priceBaseVal.textContent = `$${basePrice.toFixed(2)} (2 hrs)`;
                if (priceFactorRow) priceFactorRow.classList.remove('hidden');
                if (priceFactorLabel) priceFactorLabel.innerHTML = `Addtl. Hours (at $${config.factorRate}/hr):`;
                if (priceFactorVal) priceFactorVal.textContent = `$${factorPrice.toFixed(2)}`;
            } else if (service === 'long-distance') {
                if (duration > 50) {
                    factorPrice = (duration - 50) * config.factorRate;
                }
                totalPrice = basePrice + factorPrice;

                if (priceBaseVal) priceBaseVal.textContent = `$${basePrice.toFixed(2)} (50 mi)`;
                if (priceFactorRow) priceFactorRow.classList.remove('hidden');
                if (priceFactorLabel) priceFactorLabel.innerHTML = `Addtl. Miles (at $${config.factorRate.toFixed(2)}/mi):`;
                if (priceFactorVal) priceFactorVal.textContent = `$${factorPrice.toFixed(2)}`;
            }
        }

        if (priceTotalVal) priceTotalVal.textContent = `$${totalPrice.toFixed(2)}`;
    }

    function handleBookingLayoutChange() {
        if (!serviceCategorySelect || !bookingDurationInput || !durationGroup || !durationLabel) return;
        if (bookingMode === 'rental') {
            serviceCategorySelect.value = 'local';
            serviceCategorySelect.setAttribute('disabled', 'disabled');
            
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
                durationGroup.classList.add('hidden-field');
                bookingDurationInput.value = 1;
            } else if (service === 'local') {
                durationGroup.classList.remove('hidden-field');
                durationLabel.innerHTML = `<i class="fa-solid fa-clock"></i> Chauffeur Hours`;
                bookingDurationInput.min = 2;
                if (parseInt(bookingDurationInput.value) < 2 || !bookingDurationInput.value) {
                    bookingDurationInput.value = 2;
                }
            } else if (service === 'long-distance') {
                durationGroup.classList.remove('hidden-field');
                durationLabel.innerHTML = `<i class="fa-solid fa-road"></i> Est. Distance (Miles)`;
                bookingDurationInput.min = 50;
                if (parseInt(bookingDurationInput.value) < 50 || !bookingDurationInput.value) {
                    bookingDurationInput.value = 100;
                }
            } else {
                durationGroup.classList.add('hidden-field');
            }
        }
        
        updatePriceEstimate();
    }

    function setBookingMode(mode) {
        bookingMode = mode;
        if (mode === 'transport') {
            if (toggleTransport) toggleTransport.classList.add('active');
            if (toggleRental) toggleRental.classList.remove('active');
            if (dropoffGroup) dropoffGroup.classList.remove('hidden-field');
            if (dropoffAddressInput) dropoffAddressInput.setAttribute('required', 'required');
        } else {
            if (toggleRental) toggleRental.classList.add('active');
            if (toggleTransport) toggleTransport.classList.remove('active');
            if (dropoffGroup) dropoffGroup.classList.add('hidden-field');
            if (dropoffAddressInput) dropoffAddressInput.removeAttribute('required');
        }
        
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

    if (serviceCategorySelect) serviceCategorySelect.addEventListener('change', handleBookingLayoutChange);
    if (bookingDurationInput) bookingDurationInput.addEventListener('input', updatePriceEstimate);

    // --- 4. Live Firestore Database Availability Checkers ---
    async function checkSlotAvailability(date, time) {
        try {
            const q = query(
                bookingsCollection, 
                where("date", "==", date), 
                where("time", "==", time)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.empty;
        } catch (error) {
            console.error("Error checking availability: ", error);
            throw error;
        }
    }

    async function bookSlot(bookingDetails) {
        try {
            const newBooking = {
                ...bookingDetails,
                status: "Confirmed",
                createdAt: new Date().toISOString()
            };
            
            const docRef = await addDoc(bookingsCollection, newBooking);
            
            return {
                id: docRef.id.slice(0, 8).toUpperCase(),
                ...newBooking
            };
        } catch (error) {
            console.error("Error saving booking: ", error);
            throw error;
        }
    }

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
                console.log("Email notification sent successfully.");
            }
        } catch (error) {
            console.error("Error occurred while sending email: ", error);
        }
    }

    // --- 5. Complete Booking Submit ---
    async function completeBookingSubmit(payload) {
        try {
            submitBtn.disabled = true;
            availabilityStatus.className = "availability-status available";
            availabilityStatus.innerHTML = `
                <div class="status-indicator"></div>
                <span>Securing Booking...</span>
            `;
            availabilityStatus.classList.remove('hidden');

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

    if (bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAllValidationErrors();

            const serviceCategory = serviceCategorySelect.value;
            const bookingDate = bookingDateInput.value;
            const bookingTime = bookingTimeInput.value;
            const bookingDuration = parseInt(bookingDurationInput.value) || 0;
            const pickupAddress = pickupAddressInput.value.trim();
            const dropoffAddress = dropoffAddressInput.value.trim();
            const customerName = document.getElementById('customerName').value.trim();
            const customerEmail = document.getElementById('customerEmail').value.trim();
            const customerPhone = document.getElementById('customerPhone').value.trim();

            let isValid = true;

            isValid = validateField(
                serviceCategorySelect,
                document.getElementById('error-serviceCategory'),
                serviceCategory !== "",
                "Please select a service type."
            ) && isValid;

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

            const selectedDate = new Date(bookingDate + 'T00:00:00');
            const todayNoTime = new Date();
            todayNoTime.setHours(0,0,0,0);
            
            isValid = validateField(
                bookingDateInput,
                document.getElementById('error-bookingDate'),
                bookingDate !== "" && selectedDate >= todayNoTime,
                "Please select a valid future date."
            ) && isValid;

            isValid = validateField(
                bookingTimeInput,
                document.getElementById('error-bookingTime'),
                bookingTime !== "",
                "Preferred reservation time is required."
            ) && isValid;

            isValid = validateField(
                pickupAddressInput,
                document.getElementById('error-pickupAddress'),
                pickupAddress !== "",
                "Pick-up location address is required."
            ) && isValid;

            if (bookingMode === 'transport') {
                isValid = validateField(
                    dropoffAddressInput,
                    document.getElementById('error-dropoffAddress'),
                    dropoffAddress !== "",
                    "Drop-off location address is required."
                ) && isValid;
            }

            isValid = validateField(
                document.getElementById('customerName'),
                document.getElementById('error-customerName'),
                customerName !== "",
                "Full name is required."
            ) && isValid;

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            isValid = validateField(
                document.getElementById('customerEmail'),
                document.getElementById('error-customerEmail'),
                emailRegex.test(customerEmail),
                "Please enter a valid email address."
            ) && isValid;

            const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
            isValid = validateField(
                document.getElementById('customerPhone'),
                document.getElementById('error-customerPhone'),
                phoneRegex.test(customerPhone),
                "Please enter a valid 10-digit phone number."
            ) && isValid;

            if (!isValid) return;

            submitBtn.disabled = true;
            availabilityStatus.className = "availability-status checking";
            availabilityStatus.innerHTML = `
                <div class="status-indicator"></div>
                <span>Querying Calendar Database...</span>
            `;
            availabilityStatus.classList.remove('hidden');

            try {
                const isAvailable = await checkSlotAvailability(bookingDate, bookingTime);

                if (!isAvailable) {
                    availabilityStatus.className = "availability-status booked";
                    availabilityStatus.innerHTML = `
                        <div class="status-indicator"></div>
                        <span>Conflict Error: This slot is already booked. Please pick another time.</span>
                    `;
                    bookingDateInput.parentElement.classList.add('invalid');
                    bookingTimeInput.parentElement.classList.add('invalid');
                    submitBtn.disabled = false;
                    return;
                }

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

                if (!currentUser) {
                    showToast("Please log in to finalize your booking.", "error");
                    setTimeout(() => {
                        window.location.href = "login.html";
                    }, 1500);
                    return;
                }

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
    }

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

        if (bookingModal) bookingModal.classList.remove('hidden');
    }

    function closeModal() {
        if (bookingModal) bookingModal.classList.add('hidden');
        window.location.href = "dashboard.html";
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalOkBtn) modalOkBtn.addEventListener('click', closeModal);
    
    if (bookingModal) {
        bookingModal.addEventListener('click', (e) => {
            if (e.target === bookingModal) closeModal();
        });
    }

    // --- 8. Initial Execution ---
    setBookingMode('transport');
});
