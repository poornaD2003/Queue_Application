// --- Firebase Config (Ensure this matches your script.js) ---
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

// Initialize
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

document.addEventListener('DOMContentLoaded', () => {
    // 1. Get Kiosk ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const kioskId = urlParams.get('kioskid') || 'WALK_IN'; // Default to WALK_IN if not provided
    const orgId = urlParams.get('orgId') || urlParams.get('kioskid');
    const display = document.getElementById('kiosk-display');
    const servicesGrid = document.getElementById('services-list');
    const spinner = document.getElementById('loading-spinner');

    if (!orgId) {
        alert("Invalid QR Code Scanned!");
        window.location.href = 'qrscan.html';
        return;
    }

    display.textContent = `Organization ID: ${orgId}`;

    // 2. Listen for Auth State
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log(`User UID: ${user.uid}`);
            loadOrganizationServices(orgId, kioskId);
        } else {
            window.location.href = 'login.html';
        }
    });

    function loadOrganizationServices(organizationId, kid) {
        // Fetch services from the Organization's database node
        const servicesRef = db.ref(`users/${organizationId}/services`);

        servicesRef.on('value', (snapshot) => {
            if (spinner) spinner.style.display = 'none';
            servicesGrid.innerHTML = ''; // Clear existing

            let dynamicCardCounter = 0;

            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const childData = childSnapshot.val();
                    const childKey = childSnapshot.key;
                    const serviceName = childData.name || "Unnamed Service";

                    const isOnline = serviceName.toLowerCase().includes("online") || childData.isOnline === true;

                    if (isOnline) {
                        return; 
                    }

                    const service = {
                        id: childData.id || childKey,
                        name: serviceName
                    };

                    dynamicCardCounter++;
                    renderServiceCard(service, organizationId, kid);
                });

                if (dynamicCardCounter === 0) {
                    servicesGrid.innerHTML = '<p class="error">No walk-in kiosk services available for this organization right now.</p>';
                }

            } else {
                servicesGrid.innerHTML = '<p class="error">No services available for this organization right now.</p>';
            }
        }, (error) => {
            console.error("Database Error:", error);
            if (spinner) spinner.style.display = 'none';
            servicesGrid.innerHTML = '<p class="error">Access Denied. Check Firebase Rules.</p>';
        });
    }

    function renderServiceCard(service, organizationId, kid) {
        const card = document.createElement('div');
        card.className = 'service-card-modern glass-effect';
        card.innerHTML = `
            <div class="card-body">
                <div class="card-header-row">
                    <h3 class="service-title">${escapeHtml(service.name)}</h3>
                </div>
            </div>
            <div class="card-actions">
                <button onclick="requestToken('${service.id}', '${escapeHtml(service.name)}', '${organizationId}', '${kid}')" class="open-service-btn">
                    Get Token
                </button>
            </div>
        `;
        servicesGrid.appendChild(card);
    }

    // Quick helper to escape content safety injections inside titles
    function escapeHtml(text) {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
});

// Global function to handle token generation
window.requestToken = function (serviceId, serviceName, orgId, kioskId) {
    const user = firebase.auth().currentUser;
    if (!user) { window.location.href = 'login.html'; return; }

    const params = new URLSearchParams({
        orgId: orgId,
        serviceId: serviceId,
        serviceName: serviceName,
        kioskId: kioskId,
    });

    window.location.href = 'token.html?' + params.toString();
};