// static/js/ui.js

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));

    document.getElementById(tabName + 'Tab').classList.add('active');
    document.querySelector(`.tab[onclick*="${tabName}"]`).classList.add('active');

    if (tabName === 'history') {
        loadBookings();
    }
}

// Render courts
function renderCourts() {
    const grid = document.getElementById('courtsGrid');
    grid.innerHTML = courts.map(court => `
        <div class="resource-card" id="court-${court.id}" onclick="selectCourt(${court.id})">
            <span class="resource-type ${court.type}">${court.type.toUpperCase()}</span>
            <div class="availability-badge available">Available</div>
            <h3>${court.name}</h3>
            <p style="color: rgba(255,255,255,0.8);">${court.type === 'indoor' ? 'Climate Controlled' : 'Open Air'}</p>
            <div class="resource-price">Base: ₹${court.base_price}/hr</div>
        </div>
    `).join('');
}

// Render time slots
function renderTimeSlots() {
    const container = document.getElementById('timeSlots');
    container.innerHTML = timeSlots.map(slot => {
        const isPeak = isPeakHour(slot);
        return `
            <div class="time-slot ${isPeak ? 'peak' : ''}" id="slot-${slot}" onclick="selectTimeSlot('${slot}')">
                ${slot}
                ${isPeak ? '<span class="multiplier-badge" style="font-size: 0.7em; margin-left: 5px;">PEAK</span>' : ''}
            </div>
        `;
    }).join('');
}

// Select court
function selectCourt(courtId) {
    const court = courts.find(c => c.id === courtId);
    if (!court) return;

    // Check if court is fully booked
    const bookedSlots = bookedTimeSlots[courtId] || [];
    const isFullyBooked = timeSlots.every(slot => bookedSlots.includes(slot));

    if (isFullyBooked) {
        alert('This court is fully booked for the selected date. Please choose another court or date.');
        return;
    }

    document.querySelectorAll('.resource-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`court-${courtId}`).classList.add('selected');
    currentBooking.court = court;

    // Update time slots for selected court
    updateTimeSlotsForCourt(courtId);

    updateSummary();
    showDurationSelector();
}

// Select time slot
function selectTimeSlot(slot) {
    if (!currentBooking.court) {
        alert('Please select a court first');
        return;
    }

    // Check if slot is already booked for selected court
    const bookedSlots = bookedTimeSlots[currentBooking.court.id] || [];
    if (bookedSlots.includes(slot)) {
        alert('This time slot is already booked for the selected court');
        return;
    }

    document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
    document.getElementById(`slot-${slot}`).classList.add('selected');
    currentBooking.timeSlot = slot;

    updateSummary();
    showDurationSelector();
}

// Show duration selector
function showDurationSelector() {
    if (!currentBooking.court || !currentBooking.timeSlot) return;

    // Remove existing duration selector
    const existing = document.querySelector('.duration-selector');
    if (existing) existing.remove();

    // Check max available duration
    const startIndex = getTimeSlotIndex(currentBooking.timeSlot);
    let maxDuration = 1;

    for (let i = 1; i <= 3; i++) {
        if (checkMultiHourAvailability(currentBooking.timeSlot, i, currentBooking.court.id)) {
            maxDuration = i;
        } else {
            break;
        }
    }

    // Add new duration selector
    const timeSlotsContainer = document.querySelector('#timeSlots').parentElement;
    const selector = document.createElement('div');
    selector.className = 'duration-selector';

    let optionsHtml = '';
    for (let i = 1; i <= maxDuration; i++) {
        optionsHtml += `<option value="${i}" ${i === currentBooking.duration ? 'selected' : ''}>${i} hour${i > 1 ? 's' : ''}</option>`;
    }

    selector.innerHTML = `
        <label>Duration:</label>
        <select id="durationSelect" onchange="updateDuration(this.value)">
            ${optionsHtml}
        </select>
        <span style="color: rgba(255,255,255,0.8); margin-left: 10px; font-size: 0.9em;">
            ${pricingRules.multipleHours.enabled ?
                `(Discount: ${pricingRules.multipleHours.discountPerHour * 100}% per additional hour)` :
                ''}
        </span>
    `;
    timeSlotsContainer.appendChild(selector);

    // Update time group info
    updateTimeGroupInfo();
}

// Update duration
function updateDuration(duration) {
    currentBooking.duration = parseInt(duration);
    updateTimeGroupInfo();
    updateSummary();
}

// Update time group information display
function updateTimeGroupInfo() {
    const infoContainer = document.getElementById('timeGroupInfo');
    if (!currentBooking.timeSlot || !currentBooking.duration) {
        infoContainer.innerHTML = '';
        return;
    }

    const startIndex = getTimeSlotIndex(currentBooking.timeSlot);
    const selectedSlots = [];

    for (let i = 0; i < currentBooking.duration; i++) {
        const slot = getTimeSlotAtIndex(startIndex + i);
        if (slot) {
            selectedSlots.push(slot);
        }
    }

    if (selectedSlots.length > 1) {
        infoContainer.innerHTML = `Selected time slots: ${selectedSlots.join(' → ')}`;
    } else {
        infoContainer.innerHTML = '';
    }
}

// Render equipment
function renderEquipment() {
    const container = document.getElementById('equipmentList');
    container.innerHTML = equipment.map(item => `
        <div class="equipment-item">
            <div class="equipment-info">
                <h4>${item.name}</h4>
                <p>₹${item.price}/hr • Available: <span id="avail-${item.id}">${item.available}</span></p>
            </div>
            <div class="quantity-control">
                <button class="qty-btn" onclick="changeEquipmentQty(${item.id}, -1)" disabled>−</button>
                <span class="qty-display" id="qty-${item.id}">0</span>
                <button class="qty-btn" onclick="changeEquipmentQty(${item.id}, 1)">+</button>
            </div>
        </div>
    `).join('');
}

// Change equipment quantity
function changeEquipmentQty(equipId, delta) {
    const current = currentBooking.equipment[equipId] || 0;
    const item = equipment.find(e => e.id == equipId);

    const available = item.available || item.total_available;
    const newQty = Math.max(0, Math.min(available, current + delta));

    if (newQty === 0) {
        delete currentBooking.equipment[equipId];
    } else {
        currentBooking.equipment[equipId] = newQty;
    }

    document.getElementById(`qty-${equipId}`).textContent = newQty;

    // Update button states
    const minusBtn = document.querySelector(`button[onclick="changeEquipmentQty(${equipId}, -1)"]`);
    const plusBtn = document.querySelector(`button[onclick="changeEquipmentQty(${equipId}, 1)"]`);

    if (minusBtn) minusBtn.disabled = newQty <= 0;
    if (plusBtn) plusBtn.disabled = newQty >= available;

    updateSummary();
}

// Render coaches
function renderCoaches() {
    const container = document.getElementById('coachList');
    container.innerHTML = coaches.map(coach => `
        <div class="coach-item">
            <div class="coach-info">
                <h4>${coach.name}</h4>
                <p>₹${coach.price}/hr • ${coach.specialization}</p>
            </div>
            <div class="coach-select">
                <input type="checkbox" class="coach-checkbox" id="coach-${coach.id}"
                       onchange="selectCoach(${coach.id}, this.checked)">
            </div>
        </div>
    `).join('');
}

// Select coach
function selectCoach(coachId, checked) {
    document.querySelectorAll('.coach-checkbox').forEach(cb => {
        if (cb.id !== `coach-${coachId}`) cb.checked = false;
    });

    if (checked) {
        const coach = coaches.find(c => c.id == coachId);
        if (coach) {
            currentBooking.coach = coach;
        }
    } else {
        currentBooking.coach = null;
    }
    updateSummary();
}

// Update summary panel
function updateSummary() {
    const priceResult = calculatePrice();
    const selectedResources = document.getElementById('selectedResources');
    const priceBreakdown = document.getElementById('priceBreakdown');
    const bookBtn = document.getElementById('bookBtn');

    // Update selected resources
    let resourcesHtml = '';

    if (currentBooking.court) {
        let timeDisplay = currentBooking.timeSlot || 'Select time';
        if (currentBooking.timeSlot && currentBooking.duration > 1) {
            const startIndex = getTimeSlotIndex(currentBooking.timeSlot);
            const endSlot = getTimeSlotAtIndex(startIndex + currentBooking.duration - 1);
            if (endSlot) {
                timeDisplay = `${currentBooking.timeSlot} → ${endSlot}`;
            }
        }

        resourcesHtml += `
            <div class="selected-item">
                <span>${currentBooking.court.name} (${timeDisplay})</span>
                <button class="remove-btn" onclick="removeCourt()">Remove</button>
            </div>
        `;
    }

    for (const [equipId, qty] of Object.entries(currentBooking.equipment)) {
        const item = equipment.find(e => e.id == equipId);
        if (item && qty > 0) {
            resourcesHtml += `
                <div class="selected-item">
                    <span>${item.name} (${qty}x)</span>
                    <button class="remove-btn" onclick="removeEquipment(${equipId})">Remove</button>
                </div>
            `;
        }
    }

    if (currentBooking.coach) {
        resourcesHtml += `
            <div class="selected-item">
                <span>${currentBooking.coach.name}</span>
                <button class="remove-btn" onclick="removeCoach()">Remove</button>
            </div>
        `;
    }

    if (!resourcesHtml) {
        resourcesHtml = '<p style="color: rgba(255,255,255,0.7); text-align: center;">No resources selected</p>';
    }

    selectedResources.innerHTML = resourcesHtml;

    // Update price breakdown
    let priceHtml = '';
    priceResult.breakdown.forEach(item => {
        if (item.isMultiplier) {
            priceHtml += `<div class="price-item multiplier"><span>${item.label}</span><span>+₹${item.value}</span></div>`;
        } else if (item.isDiscount) {
            priceHtml += `<div class="price-item discount"><span>${item.label}</span><span>-₹${Math.abs(item.value)}</span></div>`;
        } else if (item.isDuration) {
            priceHtml += `<div class="price-item multiplier"><span>${item.label}</span><span>₹${item.value}</span></div>`;
        } else if (item.isTotal) {
            priceHtml += `<div class="price-item total"><span>${item.label}</span><span>₹${item.value}</span></div>`;
        } else {
            priceHtml += `<div class="price-item"><span>${item.label}</span><span>₹${item.value}</span></div>`;
        }
    });

    priceBreakdown.innerHTML = priceHtml;

    // Enable/disable book button
    const canBook = currentBooking.court &&
                  currentBooking.timeSlot &&
                  currentBooking.duration &&
                  checkMultiHourAvailability(currentBooking.timeSlot, currentBooking.duration, currentBooking.court.id);

    bookBtn.disabled = !canBook;
}

// Remove court
function removeCourt() {
    currentBooking.court = null;
    document.querySelectorAll('.resource-card').forEach(c => c.classList.remove('selected'));
    updateSummary();
}

// Remove equipment
function removeEquipment(equipId) {
    delete currentBooking.equipment[equipId];
    document.getElementById(`qty-${equipId}`).textContent = '0';
    updateSummary();
}

// Remove coach
function removeCoach() {
    currentBooking.coach = null;
    document.querySelectorAll('.coach-checkbox').forEach(cb => cb.checked = false);
    updateSummary();
}

// Render booking history
function renderBookingHistory() {
    const container = document.getElementById('bookingHistory');

    // Filter bookings for current user if needed
    const userBookings = allBookings; // You might want to filter by user

    if (!userBookings || userBookings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No bookings yet. Make your first booking!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = userBookings.map(booking => {
        let timeDisplay = booking.time_slot;
        if (booking.duration > 1) {
            const startIndex = getTimeSlotIndex(booking.time_slot);
            const endSlot = getTimeSlotAtIndex(startIndex + booking.duration - 1);
            if (endSlot) {
                timeDisplay = `${booking.time_slot} → ${endSlot}`;
            }
        }

        return `
        <div class="history-item">
            <div class="history-header">
                <div class="booking-id">Booking #${booking.id}</div>
                <div class="booking-date">${booking.date} • ${timeDisplay}</div>
            </div>
            <div class="history-details">
                <div class="history-detail">
                    <span>Court:</span>
                    <span>${booking.court.name} (${booking.court.type})</span>
                </div>
                ${booking.equipment && booking.equipment.length > 0 ? `
                <div class="history-detail">
                    <span>Equipment:</span>
                    <span>${booking.equipment.map(e => `${e.name} (${e.quantity}x)`).join(', ')}</span>
                </div>
                ` : ''}
                ${booking.coach ? `
                <div class="history-detail">
                    <span>Coach:</span>
                    <span>${booking.coach.name}</span>
                </div>
                ` : ''}
                <div class="history-detail" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
                    <span style="font-weight: 600;">Total:</span>
                    <span style="font-weight: 600;">₹${booking.total_price}</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// Show success modal
function showSuccessModal(message) {
    const modal = document.getElementById('successModal');
    const modalDetails = document.getElementById('modalDetails');

    modalDetails.innerHTML = message;
    modal.classList.add('active');
}

// Close modal
function closeModal() {
    document.getElementById('successModal').classList.remove('active');
}

// Logout
function logout() {
    window.location.href = '/logout';
}
