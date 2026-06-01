// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyDQF6Ax8-96AKns_8XpgM-MDrtaVDc78CU",
    authDomain: "ecosystem-e703c.firebaseapp.com",
    databaseURL: "https://ecosystem-e703c-default-rtdb.firebaseio.com",
    projectId: "ecosystem-e703c",
    storageBucket: "ecosystem-e703c.firebasestorage.app",
    messagingSenderId: "127085232481",
    appId: "1:127085232481:web:edc94cfe0b5a86d8a40520",
    measurementId: "G-6FNBEKNFSQ"
};

// Initialize Firebase
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

document.addEventListener('DOMContentLoaded', () => {
    const bookingForm = document.getElementById('appointment-form');
    const spinner = document.getElementById('booking-spinner');
    const serviceDisplay = document.getElementById('service-display-name');

    // Extract booking params routed from appointments.html
    const urlParams = new URLSearchParams(window.location.search);
    const orgId = urlParams.get('orgId');
    const serviceId = urlParams.get('serviceId');
    const serviceName = urlParams.get('serviceName') || "Online Appointment";

    if (!orgId || !serviceId) {
        alert("⚠️ Invalid booking session parameters. Returning to main directory.");
        window.location.href = 'appointments.html';
        return;
    }

    // Render targeted booking context text header
    serviceDisplay.textContent = `Booking for: ${serviceName}`;

    // Verify authentication and prefill fields if available
    auth.onAuthStateChanged((user) => {
        if (user) {
            if (spinner) spinner.style.display = 'none';
            bookingForm.style.display = 'block';

            // Autofill profile properties from auth object to reduce manual inputs
            if (user.displayName) document.getElementById('customer-name').value = user.displayName;
            if (user.email) document.getElementById('customer-email').value = user.email;
            if (user.phoneNumber) document.getElementById('customer-phone').value = user.phoneNumber;

            // Limit date field selections starting minimum from today onwards
            document.getElementById('appointment-date').min = new Date().toISOString().split('T')[0];
        } else {
            window.location.href = 'login.html';
        }
    });

    // Handle form submission logic
    bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const nameValue = document.getElementById('customer-name').value.trim();
        const phoneValue = document.getElementById('customer-phone').value.trim();
        const emailValue = document.getElementById('customer-email').value.trim();
        const dateValue = document.getElementById('appointment-date').value;
        const timeValue = document.getElementById('selected-time-slot').value;

        if (!timeValue) {
            alert("⚠️ Please select an active time slot from the grid components before checking out.");
            return;
        }

        // Create a unique appointment ID reference node under the specific organization
        const orgAppointmentsRef = db.ref(`users/${orgId}/onlineAppointments`).push();
        const appointmentId = orgAppointmentsRef.key;

        // Construct the custom payload requested
        const appointmentData = {
            appointmentId: appointmentId,
            customerId: currentUser.uid, // Logged-in person's UID
            customerName: nameValue,
            mobileNumber: phoneValue,
            email: emailValue,
            appointmentDate: dateValue,
            appointmentTime: timeValue,
            status: "pending"
        };

        // Save strictly under the organization's node path
        orgAppointmentsRef.set(appointmentData)
            .then(() => {
                // 🌟 FIREBASE TRANSACTION COMPLETED SUCCESSFULLY -> TRIGGER EMAIL NOW
                sendConfirmationEmail(emailValue, nameValue, dateValue, timeValue);

                alert("🎉 Appointment Booked Successfully & Confirmation Email Sent!");
                // Redirect back to the main appointments overview directory
                window.location.href = 'appointments.html';
            })
            .catch((error) => {
                console.error("Booking submit error:", error);
                alert(`⚠️ Database error: ${error.message}`);
            });
    });

    document.getElementById('appointment-date').addEventListener('change', function (e) {
        fetchAndRenderSlots(orgId, e.target.value);
    });

    function fetchAndRenderSlots(targetOrgId, selectedDate) {
        const gridContainer = document.getElementById('slots-grid-container');
        gridContainer.innerHTML = "⏳ Scanning calendar...";

        db.ref(`users/${targetOrgId}/onlineAppointments`).once('value', (snapshot) => {
            const activeBookings = snapshot.val() || {};
            const takenSlots = [];

            // Compile lists of times slots matching target dates which are blocked
            Object.keys(activeBookings).forEach(id => {
                const booking = activeBookings[id];
                // 🌟 CHANGED: Slot is only taken if it matches date AND is active (pending or approved)
                if (booking.appointmentDate === selectedDate && (booking.status === "pending" || booking.status === "approved")) {
                    takenSlots.push(booking.appointmentTime);
                }
            });

            gridContainer.innerHTML = "";
            const hours = { openTime: "08:00", closeTime: "15:00", slotDurationMinutes: 30 };
            let currentStringTime = hours.openTime;

            while (currentStringTime < hours.closeTime) {
                const isBooked = takenSlots.includes(currentStringTime);

                // 🌟 CHANGED: If it is booked, we drop rendering completely (Disappear from layout context)
                if (!isBooked) {
                    const slotButton = document.createElement('div');
                    slotButton.className = 'slot-card free';
                    slotButton.textContent = formatTo12Hour(currentStringTime);
                    slotButton.style.cssText = "padding:10px; border:1px solid #10b981; border-radius:6px; text-align:center; cursor:pointer; color:#10b981;";

                    const slotTimeConst = currentStringTime; // Retain primitive scoping closure
                    slotButton.addEventListener('click', () => {
                        document.querySelectorAll('.slot-card.free').forEach(b => {
                            b.style.background = "transparent";
                            b.style.color = "#10b981";
                        });
                        slotButton.style.background = "#10b981";
                        slotButton.style.color = "#fff";
                        
                        document.getElementById('selected-time-slot').value = slotTimeConst;
                    });

                    gridContainer.appendChild(slotButton);
                }

                currentStringTime = addMinutesToTime(currentStringTime, hours.slotDurationMinutes);
            }

            if (gridContainer.children.length === 0) {
                gridContainer.innerHTML = "<p style='color:#ef4444;'>⚠️ No free slots available for this selected date scope.</p>";
            }
        });
    }

    // Time calculation helper utility functions
    function addMinutesToTime(timeString, minsToAdd) {
        let [hours, minutes] = timeString.split(':').map(Number);
        minutes += minsToAdd;
        hours += Math.floor(minutes / 60);
        minutes = minutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    function formatTo12Hour(timeString) {
        let [hours, minutes] = timeString.split(':');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${ampm}`;
    }

    // New helper function to process the EmailJS API delivery request
    function sendConfirmationEmail(targetEmail, customerName, appointmentDate, appointmentTime) {
        // Map form parameters to the matching template tokens inside your dashboard
        const templateParams = {
            customerName: customerName,
            appointmentDate: appointmentDate,
            appointmentTime: appointmentTime,
            email: targetEmail
        };

        // Send the payload securely via the EmailJS client engine
        // Replace placeholders below with your exact dashboard strings
        emailjs.send('service_adcclwr', 'template_6o00nsh', templateParams)
            .then((response) => {
                console.log('Email dispatched successfully!', response.status, response.text);
            }, (error) => {
                console.error('Email delivery engine failed:', error);
            });
    }
});