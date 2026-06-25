/**
 * MTA Solo Van - Frontend Application Logic
 * Implements mobile navigation, interactive booking toggles, frontend validation,
 * and a simulated live database for calendar booking slot availability.
 */

document.addEventListener('DOMContentLoaded', () => {
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

    // --- 4. Simulated Calendar Database Setup ---
    // Default pre-seeded bookings to demonstrate collision checks
    const defaultBookings = [
        {
            id: "MTA-8924",
            name: "Alexander Mercer",
            email: "alex.mercer@corp.com",
            phone: "(214) 555-0142",
            mode: "transport",
            serviceCategory: "airport",
            date: getFutureDateOffset(1), // Tomorrow
            time: "10:00",
            pickup: "DFW Airport Terminal D",
            dropoff: "Omni Hotel Downtown Dallas",
            price: "$150.00",
            status: "Confirmed"
        },
        {
            id: "MTA-3105",
            name: "Catherine Vance",
            email: "cvance@lifestyle.org",
            phone: "(310) 555-9821",
            mode: "rental",
            serviceCategory: "local",
            date: getFutureDateOffset(2), // Day after tomorrow
            time: "14:30",
            pickup: "Los Angeles Airport (LAX)",
            dropoff: "N/A (Solo Rental)",
            price: "$348.00",
            status: "Confirmed"
        }
    ];

    // Helper to get offset dates
    function getFutureDateOffset(daysOffset) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysOffset);
        const y = targetDate.getFullYear();
        const m = String(targetDate.getMonth() + 1).padStart(2, '0');
        const d = String(targetDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Load bookings database
    function getSimulatedDatabase() {
        const stored = localStorage.getItem('mta_van_bookings');
        if (!stored) {
            localStorage.setItem('mta_van_bookings', JSON.stringify(defaultBookings));
            return defaultBookings;
        }
        return JSON.parse(stored);
    }

    function saveToSimulatedDatabase(bookings) {
        localStorage.setItem('mta_van_bookings', JSON.stringify(bookings));
    }

    // Render bookings table list
    function renderBookingsTable() {
        const bookings = getSimulatedDatabase();
        bookingsList.innerHTML = '';

        if (bookings.length === 0) {
            bookingsList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">No reservations booked yet. Form submissions will appear here.</td>
                </tr>
            `;
            return;
        }

        // Sort by date then time
        const sortedBookings = [...bookings].sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.time.localeCompare(b.time);
        });

        sortedBookings.forEach(booking => {
            const tr = document.createElement('tr');
            
            const serviceLabel = booking.serviceCategory.charAt(0).toUpperCase() + booking.serviceCategory.slice(1);
            const modeLabel = booking.mode === 'transport' ? 'Chauffeur Ride' : 'Van Rental';
            const route = booking.mode === 'transport' ? `${booking.pickup} → ${booking.dropoff}` : `Pick-up: ${booking.pickup}`;

            tr.innerHTML = `
                <td><strong>${booking.name}</strong></td>
                <td>${serviceLabel}</td>
                <td><span class="text-muted">${modeLabel}</span></td>
                <td>${booking.date} at <strong>${booking.time}</strong></td>
                <td><span style="font-size: 0.82rem;">${route}</span></td>
                <td><strong>${booking.price || '$0.00'}</strong></td>
                <td><span class="badge-status confirmed">${booking.status}</span></td>
            `;
            bookingsList.appendChild(tr);
        });
    }

    // Reset database handler
    if (clearBookingsBtn) {
        clearBookingsBtn.addEventListener('click', () => {
            localStorage.removeItem('mta_van_bookings');
            // Re-initialize and render
            getSimulatedDatabase();
            renderBookingsTable();
        });
    }

    // --- 5. Backend-Ready Availability APIs (Simulated) ---

    /**
     * HOOK FOR BACKEND: Availability Checker
     * Replace this placeholder with a fetch() call to your server database.
     * E.g., fetch(`/api/availability?date=${date}&time=${time}`)
     * 
     * Enforces the rule: If a date and time slot is already booked, prevent other users from selecting it.
     * 
     * @param {string} date - Format: YYYY-MM-DD
     * @param {string} time - Format: HH:MM
     * @returns {Promise<boolean>} True if slot is free, False if already booked.
     */
    async function checkSlotAvailability(date, time) {
        // Simulate minor API roundtrip lag (500ms)
        await new Promise(resolve => setTimeout(resolve, 800));

        const bookings = getSimulatedDatabase();
        // Check if there is an exact match for date and time.
        // A real system might check slot ranges (e.g., block a 3-hour window). For simplicity, we check exact collisions here.
        const collision = bookings.find(booking => booking.date === date && booking.time === time);
        
        return !collision; // Returns true if slot is available (no collision)
    }

    /**
     * HOOK FOR BACKEND: Book Slot
     * Replace this placeholder with a POST request to your backend database.
     * E.g., fetch('/api/book', { method: 'POST', body: JSON.stringify(details) })
     * 
     * @param {object} bookingDetails - Complete booking metadata
     * @returns {Promise<object>} Saved booking invoice details
     */
    async function bookSlot(bookingDetails) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const bookings = getSimulatedDatabase();
        const newBooking = {
            id: `MTA-${Math.floor(1000 + Math.random() * 9000)}`,
            ...bookingDetails,
            status: "Confirmed"
        };

        bookings.push(newBooking);
        saveToSimulatedDatabase(bookings);
        return newBooking;
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

            const confirmedBooking = await bookSlot(bookingPayload);

            // Hide loading indicator
            availabilityStatus.classList.add('hidden');
            submitBtn.disabled = false;

            // Trigger Success Modal
            showReceiptModal(confirmedBooking);

            // Refresh simulated DB table
            renderBookingsTable();
            
            // Reset form inputs
            bookingForm.reset();
            setBookingMode('transport'); // Reset to default mode

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
    renderBookingsTable();
    setBookingMode('transport'); // Set initial layout and calculate initial price
});
