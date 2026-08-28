/**
 * Championship Booking Engine — Manga Orange Edition
 */

const bookingState = {
    date: new Date().toISOString().split('T')[0],
    duration: 1,
    selectedCourt: null,
    selectedSlot: null,
    selectedCoach: null,
    equipmentRequests: {},
    courts: [],
    coaches: [],
    equipment: [],
    timeSlots: [],
    bookedCourtSlots: {},
    equipmentAvailability: {}
};

document.addEventListener('DOMContentLoaded', async () => {
    initDatePicker();
    await loadInitialResources();
    renderCourts();
    renderCoaches();
    renderEquipment();
    await refreshAvailability();
});

function initDatePicker() {
    const datePicker = document.getElementById('bookingDate');
    if (datePicker) {
        const todayStr = new Date().toISOString().split('T')[0];
        datePicker.value = todayStr;
        datePicker.min = todayStr;
        bookingState.date = todayStr;
    }
}

async function loadInitialResources() {
    try {
        const [courts, coaches, equipment, slots] = await Promise.all([
            ApiClient.get('/api/courts'),
            ApiClient.get('/api/coaches'),
            ApiClient.get('/api/equipment'),
            ApiClient.get('/api/timeslots')
        ]);

        bookingState.courts = courts;
        bookingState.coaches = coaches;
        bookingState.equipment = equipment;
        bookingState.timeSlots = slots;
    } catch (err) {
        ApiClient.showToast('Failed to load court resources. Please refresh.', 'error');
    }
}

async function refreshAvailability() {
    try {
        const availability = await ApiClient.get(`/api/check_availability?date=${bookingState.date}`);
        bookingState.bookedCourtSlots = availability.booked_time_slots || availability.booked_courts || {};
        bookingState.equipmentAvailability = availability.equipment_availability || {};
        
        renderCourts();
        if (bookingState.selectedCourt) {
            renderTimeSlots();
        }
        updateEquipmentStockLabels();
    } catch (err) {
        console.error('Error loading slot availability:', err);
    }
}

function onDateOrDurationChange() {
    bookingState.date = document.getElementById('bookingDate').value;
    bookingState.duration = parseInt(document.getElementById('bookingDuration').value, 10);
    
    // Reset slot selection on date/duration change
    bookingState.selectedSlot = null;
    refreshAvailability().then(() => {
        updateSummary();
    });
}

function renderCourts() {
    const container = document.getElementById('courts-grid');
    if (!container) return;

    container.innerHTML = bookingState.courts.map(court => {
        const isSelected = bookingState.selectedCourt && bookingState.selectedCourt.id === court.id;
        const courtBookedSlots = bookingState.bookedCourtSlots[court.id] || [];
        const isFullyBooked = bookingState.timeSlots.length > 0 && courtBookedSlots.length >= bookingState.timeSlots.length;

        return `
            <div id="court-card-${court.id}" 
                 class="court-tile-pro ${isSelected ? 'selected' : ''} ${isFullyBooked ? 'unavailable' : ''}"
                 onclick="selectCourt(${court.id})">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                        <h4 style="font-size: 1.15rem; font-weight: 800;">${court.name}</h4>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">BWF Standard Pro Court</div>
                    </div>
                    <span class="badge-pro ${court.type === 'indoor' ? 'badge-indoor' : 'badge-outdoor'}">
                        ${court.type}
                    </span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 12px; margin-top: 12px; font-size: 0.92rem;">
                    <span>Base: <strong style="color: var(--orange-primary); font-size: 1.1rem; font-family: var(--font-heading);">₹${court.base_price}</strong><span style="font-size: 0.8rem; color: var(--text-dim);">/hr</span></span>
                    <span class="badge-pro ${isFullyBooked ? 'badge-status-busy' : 'badge-status-open'}">
                        ${isFullyBooked ? 'Sold Out' : 'Available'}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function selectCourt(courtId) {
    const court = bookingState.courts.find(c => c.id === courtId);
    if (!court) return;

    bookingState.selectedCourt = court;
    bookingState.selectedSlot = null; // reset slot
    renderCourts();
    renderTimeSlots();
    updateSummary();
}

function renderTimeSlots() {
    const container = document.getElementById('slots-container');
    if (!container || !bookingState.selectedCourt) return;

    const bookedSlots = bookingState.bookedCourtSlots[bookingState.selectedCourt.id] || [];

    const slotChips = bookingState.timeSlots.map((slot, idx) => {
        let hasConflict = false;
        if (idx + bookingState.duration > bookingState.timeSlots.length) {
            hasConflict = true;
        } else {
            for (let i = 0; i < bookingState.duration; i++) {
                const subSlot = bookingState.timeSlots[idx + i];
                if (bookedSlots.includes(subSlot)) {
                    hasConflict = true;
                    break;
                }
            }
        }

        const isSelected = bookingState.selectedSlot === slot;

        return `
            <button type="button" 
                    class="slot-chip-pro ${hasConflict ? 'booked' : ''} ${isSelected ? 'selected' : ''}"
                    ${hasConflict ? 'disabled' : ''}
                    onclick="selectTimeSlot('${slot}')">
                ${slot}
            </button>
        `;
    }).join('');

    container.innerHTML = `
        <div class="slots-grid-pro">
            ${slotChips}
        </div>
    `;
}

function selectTimeSlot(slot) {
    bookingState.selectedSlot = slot;
    renderTimeSlots();
    updateSummary();
}

function renderCoaches() {
    const container = document.getElementById('coaches-grid');
    if (!container) return;

    container.innerHTML = `
        <div class="court-tile-pro ${bookingState.selectedCoach === null ? 'selected' : ''}"
             onclick="selectCoach(null)" style="padding: 16px;">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 4px;">No Personal Coach</div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">Independent practice session</div>
        </div>
    ` + bookingState.coaches.map(coach => {
        const isSelected = bookingState.selectedCoach && bookingState.selectedCoach.id === coach.id;
        return `
            <div class="court-tile-pro ${isSelected ? 'selected' : ''}"
                 onclick="selectCoach(${coach.id})" style="padding: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                    <div style="font-weight: 800; font-size: 1rem; color: var(--text-white);">${coach.name}</div>
                    <div style="font-size: 0.95rem; color: var(--orange-primary); font-weight: 800;">+₹${coach.price}</div>
                </div>
                <div style="font-size: 0.82rem; color: var(--text-muted);">${coach.specialization || 'BWF Certified Coach'}</div>
            </div>
        `;
    }).join('');
}

function selectCoach(coachId) {
    if (coachId === null) {
        bookingState.selectedCoach = null;
    } else {
        bookingState.selectedCoach = bookingState.coaches.find(c => c.id === coachId) || null;
    }
    renderCoaches();
    updateSummary();
}

function renderEquipment() {
    const container = document.getElementById('equipment-grid');
    if (!container) return;

    container.innerHTML = bookingState.equipment.map(item => {
        const currentQty = bookingState.equipmentRequests[item.id] || 0;
        const available = bookingState.equipmentAvailability[item.id] !== undefined 
            ? bookingState.equipmentAvailability[item.id] 
            : item.total_available;

        return `
            <div class="pro-card" style="padding: 18px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 800; font-size: 1rem; color: var(--text-white);">${item.name}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                        <strong style="color: var(--orange-light);">₹${item.price}</strong> / unit • <span id="eq-stock-${item.id}" style="color: var(--accent-green); font-weight: 700;">${available}</span> in stock
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button type="button" class="btn-manga btn-manga-secondary btn-manga-sm" style="padding: 6px 14px;" onclick="changeEquipmentQty(${item.id}, -1)">-</button>
                    <span id="eq-qty-${item.id}" style="font-weight: 900; font-size: 1.1rem; min-width: 24px; text-align: center; color: var(--text-white);">${currentQty}</span>
                    <button type="button" class="btn-manga btn-manga-secondary btn-manga-sm" style="padding: 6px 14px;" onclick="changeEquipmentQty(${item.id}, 1)">+</button>
                </div>
            </div>
        `;
    }).join('');
}

function changeEquipmentQty(equipId, delta) {
    const current = bookingState.equipmentRequests[equipId] || 0;
    const item = bookingState.equipment.find(e => e.id === equipId);
    const available = bookingState.equipmentAvailability[equipId] !== undefined 
        ? bookingState.equipmentAvailability[equipId] 
        : (item ? item.total_available : 10);

    const nextVal = Math.max(0, Math.min(available, current + delta));
    bookingState.equipmentRequests[equipId] = nextVal;
    
    const qtyElem = document.getElementById(`eq-qty-${equipId}`);
    if (qtyElem) qtyElem.textContent = nextVal;

    updateSummary();
}

function updateEquipmentStockLabels() {
    bookingState.equipment.forEach(item => {
        const avail = bookingState.equipmentAvailability[item.id] !== undefined
            ? bookingState.equipmentAvailability[item.id]
            : item.total_available;
        const stockElem = document.getElementById(`eq-stock-${item.id}`);
        if (stockElem) stockElem.textContent = avail;
    });
}

async function updateSummary() {
    const emptyBox = document.getElementById('summary-empty');
    const contentBox = document.getElementById('summary-content');

    if (!bookingState.selectedCourt || !bookingState.selectedSlot) {
        if (emptyBox) emptyBox.style.display = 'block';
        if (contentBox) contentBox.style.display = 'none';
        return;
    }

    if (emptyBox) emptyBox.style.display = 'none';
    if (contentBox) contentBox.style.display = 'block';

    document.getElementById('sum-court').textContent = bookingState.selectedCourt.name;
    document.getElementById('sum-time').textContent = `${bookingState.date} @ ${bookingState.selectedSlot}`;
    document.getElementById('sum-duration').textContent = `${bookingState.duration} Hour${bookingState.duration > 1 ? 's' : ''}`;
    document.getElementById('sum-coach').textContent = bookingState.selectedCoach ? bookingState.selectedCoach.name : 'None';

    try {
        const preview = await ApiClient.post('/api/calculate-price', {
            court_id: bookingState.selectedCourt.id,
            date: bookingState.date,
            time_slot: bookingState.selectedSlot,
            duration: bookingState.duration,
            coach_id: bookingState.selectedCoach ? bookingState.selectedCoach.id : null,
            equipment: bookingState.equipmentRequests
        });

        const breakdownContainer = document.getElementById('breakdown-list');
        const breakdown = preview.data.breakdown || [];

        breakdownContainer.innerHTML = breakdown
            .filter(item => item.type !== 'total')
            .map(item => `
                <div class="price-line-item ${item.value < 0 ? 'discount' : ''}">
                    <span>${item.label}</span>
                    <span>${item.value < 0 ? '-' : ''}₹${Math.abs(item.value)}</span>
                </div>
            `).join('');

        document.getElementById('sum-total').textContent = `₹${preview.data.total_price}`;
    } catch (err) {
        console.error('Failed to preview price:', err);
    }
}

async function submitBooking() {
    if (!bookingState.selectedCourt || !bookingState.selectedSlot) {
        ApiClient.showToast('Please select a court and start time slot', 'error');
        return;
    }

    const btn = document.getElementById('btnConfirmBooking');
    btn.disabled = true;
    btn.innerHTML = '<span>Locking Court Slot...</span>';

    try {
        const payload = {
            court_id: bookingState.selectedCourt.id,
            date: bookingState.date,
            time_slot: bookingState.selectedSlot,
            duration: bookingState.duration,
            coach_id: bookingState.selectedCoach ? bookingState.selectedCoach.id : null,
            equipment: bookingState.equipmentRequests
        };

        const result = await ApiClient.post('/api/bookings/create', payload);

        if (result.success) {
            ApiClient.showToast(`Court Reserved! Match ID #${result.booking_id || (result.data && result.data.booking_id)} 🏸`, 'success');

            // Reset selection
            bookingState.selectedSlot = null;
            bookingState.equipmentRequests = {};
            bookingState.selectedCoach = null;
            bookingState.duration = 1;
            document.getElementById('bookingDuration').value = '1';

            renderCoaches();
            renderEquipment();
            await refreshAvailability();
            updateSummary();

            setTimeout(() => switchMainTab('history'), 600);
        } else {
            ApiClient.showToast(result.message || 'Booking failed.', 'error');
        }
    } catch (err) {
        ApiClient.showToast(err.message || 'An error occurred during booking.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Smash & Reserve Court</span><span>⚡</span>';
    }
}

function switchMainTab(tab) {
    const bookView = document.getElementById('view-book');
    const historyView = document.getElementById('view-history');
    
    const tabBook = document.getElementById('tab-book');
    const tabHistory = document.getElementById('tab-history');

    // Reset views
    bookView.style.display = 'none';
    historyView.style.display = 'none';

    tabBook.className = 'btn-manga btn-manga-secondary';
    tabHistory.className = 'btn-manga btn-manga-secondary';

    if (tab === 'book') {
        bookView.style.display = 'block';
        tabBook.className = 'btn-manga btn-manga-primary';
    } else if (tab === 'history') {
        historyView.style.display = 'block';
        tabHistory.className = 'btn-manga btn-manga-primary';
        loadBookingHistory();
    }
}

async function loadBookingHistory() {
    const container = document.getElementById('history-container');
    container.innerHTML = '<p style="color: var(--text-muted);">Loading your match records...</p>';

    try {
        const bookings = await ApiClient.get('/api/bookings');
        if (!bookings || bookings.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 48px 0; color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 12px; opacity: 0.7;">🏸</div>
                    <h4 style="font-size: 1.2rem; color: var(--text-white); margin-bottom: 6px;">No Court Bookings Found</h4>
                    <p style="font-size: 0.9rem; margin-bottom: 18px;">Step onto the court by making your first reservation today.</p>
                    <button class="btn-manga btn-manga-primary btn-manga-sm" onclick="switchMainTab('book')">Reserve a Court Now</button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="pro-table-wrap">
                <table class="pro-table">
                    <thead>
                        <tr>
                            <th>Match ID</th>
                            <th>Court</th>
                            <th>Date & Time</th>
                            <th>Duration</th>
                            <th>Coach & Rentals</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th style="text-align: right;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bookings.map(b => `
                            <tr>
                                <td style="font-weight: 900; color: var(--orange-primary);">#${b.id}</td>
                                <td style="font-weight: 700; color: var(--text-white);">${b.court ? b.court.name : 'Court #' + b.court_id}</td>
                                <td>${b.date} @ <strong style="color: var(--text-white);">${b.time_slot}</strong></td>
                                <td>${b.duration} hr${b.duration > 1 ? 's' : ''}</td>
                                <td style="font-size: 0.85rem; color: var(--text-muted);">
                                    ${b.coach ? `<span style="color: var(--orange-light); font-weight: 700;">Coach: ${b.coach.name}</span><br>` : ''}
                                    ${(b.equipment && b.equipment.length > 0) ? b.equipment.map(e => `${e.name} (${e.quantity}x)`).join(', ') : 'None'}
                                </td>
                                <td style="font-weight: 900; color: var(--text-white); font-family: var(--font-heading); font-size: 1.05rem;">₹${b.total_price}</td>
                                <td>
                                    <span class="badge-pro ${b.status === 'confirmed' ? 'badge-status-open' : 'badge-status-busy'}">
                                        ${b.status}
                                    </span>
                                </td>
                                <td style="text-align: right;">
                                    ${b.status === 'confirmed' ? `
                                        <button class="btn-manga btn-manga-danger btn-manga-sm" onclick="cancelBooking(${b.id})">
                                            Cancel
                                        </button>
                                    ` : '<span style="color: var(--text-dim); font-size: 0.85rem;">Released</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<p style="color: var(--accent-red);">Failed to load bookings: ${err.message}</p>`;
    }
}

async function cancelBooking(bookingId) {
    if (!confirm(`Cancel Match Booking #${bookingId}? Slot locks will be immediately released.`)) return;

    try {
        const result = await ApiClient.post(`/api/bookings/${bookingId}/cancel`);
        if (result.success) {
            ApiClient.showToast(`Booking #${bookingId} cancelled successfully.`, 'info');
            loadBookingHistory();
        } else {
            ApiClient.showToast(result.message || 'Failed to cancel booking.', 'error');
        }
    } catch (err) {
        ApiClient.showToast(err.message || 'Error cancelling booking.', 'error');
    }
}
