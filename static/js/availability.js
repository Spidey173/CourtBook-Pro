// static/js/availability.js

// Update availability
async function updateAvailability() {
    const dateInput = document.getElementById('bookingDate');
    if (dateInput.value) {
        currentBooking.date = dateInput.value;

        // Reset booked time slots
        bookedTimeSlots = {};

        // Initialize structure for all courts
        courts.forEach(court => {
            bookedTimeSlots[court.id] = [];
        });

        // Check availability for selected date
        try {
            const response = await fetch(`/api/check_availability?date=${currentBooking.date}`);
            if (response.ok) {
                const availability = await response.json();

                // Update booked time slots from API response
                if (availability.booked_time_slots) {
                    Object.keys(availability.booked_time_slots).forEach(courtId => {
                        const courtIdInt = parseInt(courtId);
                        if (availability.booked_time_slots[courtId]) {
                            bookedTimeSlots[courtIdInt] = availability.booked_time_slots[courtId];
                        }
                    });
                }

                // Also check all existing bookings for this date
                const bookingsForDate = allBookings.filter(booking =>
                    booking.date === currentBooking.date
                );

                // Process each booking to mark time slots as booked
                bookingsForDate.forEach(booking => {
                    if (booking.court_id && booking.time_slot && booking.duration) {
                        const courtId = booking.court_id;
                        const startSlot = booking.time_slot;
                        const duration = booking.duration || 1;

                        // Get all time slots for this booking
                        const bookingSlots = getTimeSlotsForDuration(startSlot, duration);

                        // Add all slots to bookedTimeSlots
                        bookingSlots.forEach(slot => {
                            if (!bookedTimeSlots[courtId].includes(slot)) {
                                bookedTimeSlots[courtId].push(slot);
                            }
                        });
                    }
                });

                // Update court availability status
                updateCourtAvailability();

                // Update time slots UI if a court is selected
                if (currentBooking.court) {
                    updateTimeSlotsForCourt(currentBooking.court.id);
                }

                // Update equipment availability
                if (availability.equipment_availability) {
                    equipment.forEach(item => {
                        const availableQty = availability.equipment_availability[item.id] || item.total_available;
                        document.getElementById(`avail-${item.id}`).textContent = availableQty;

                        // Update button states
                        const currentQty = currentBooking.equipment[item.id] || 0;
                        const plusBtn = document.querySelector(`button[onclick="changeEquipmentQty(${item.id}, 1)"]`);
                        if (plusBtn) {
                            plusBtn.disabled = currentQty >= availableQty;
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error checking availability:', error);
        }

        updateSummary();
    }
}

// Update court availability display
function updateCourtAvailability() {
    courts.forEach(court => {
        const card = document.getElementById(`court-${court.id}`);
        if (!card) return;

        const badge = card.querySelector('.availability-badge');
        const bookedSlots = bookedTimeSlots[court.id] || [];

        // Check if court is fully booked (all time slots are booked)
        const isFullyBooked = timeSlots.every(slot =>
            bookedSlots.includes(slot)
        );

        // Check if court has any bookings
        const hasBookings = bookedSlots.length > 0;

        if (isFullyBooked) {
            card.classList.add('unavailable');
            badge.className = 'availability-badge unavailable-badge';
            badge.textContent = 'Fully Booked';
        } else if (hasBookings) {
            card.classList.remove('unavailable');
            badge.className = 'availability-badge partially-available';
            badge.textContent = 'Partially Booked';
        } else {
            card.classList.remove('unavailable');
            badge.className = 'availability-badge available';
            badge.textContent = 'Available';
        }
    });
}

// Get time slots for a duration starting from a specific slot
function getTimeSlotsForDuration(startSlot, duration) {
    const slots = [];
    const startIndex = getTimeSlotIndex(startSlot);

    if (startIndex === -1) return slots;

    for (let i = 0; i < duration; i++) {
        const slot = getTimeSlotAtIndex(startIndex + i);
        if (slot) {
            slots.push(slot);
        }
    }

    return slots;
}

// Update time slots display for a specific court
function updateTimeSlotsForCourt(courtId) {
    const bookedSlots = bookedTimeSlots[courtId] || [];

    document.querySelectorAll('.time-slot').forEach(slot => {
        const slotTime = slot.id.replace('slot-', '');
        const isBooked = bookedSlots.includes(slotTime);

        if (isBooked) {
            slot.classList.add('booked');
            slot.classList.remove('selected');
            slot.classList.remove('unavailable');
        } else {
            slot.classList.remove('booked');
        }
    });
}

// Check if time is in peak hours
function isPeakHour(time) {
    if (!time || !pricingRules.peakHours.enabled) return false;

    const [hour, minute] = time.split(':').map(Number);
    const timeInMinutes = hour * 60 + minute;

    const [startHour, startMinute] = pricingRules.peakHours.start.split(':').map(Number);
    const startTime = startHour * 60 + startMinute;

    const [endHour, endMinute] = pricingRules.peakHours.end.split(':').map(Number);
    const endTime = endHour * 60 + endMinute;

    return timeInMinutes >= startTime && timeInMinutes < endTime;
}

// Check if date is weekend
function isWeekend(dateString) {
    if (!dateString || !pricingRules.weekend.enabled) return false;

    const date = new Date(dateString);
    return date.getDay() === 0 || date.getDay() === 6; // 0 = Sunday, 6 = Saturday
}

// Get time slot index
function getTimeSlotIndex(time) {
    return timeSlots.findIndex(slot => slot === time);
}

// Get time slot at index
function getTimeSlotAtIndex(index) {
    return timeSlots[index];
}

// Check if time slots are available for multi-hour booking
function checkMultiHourAvailability(startSlot, duration, courtId) {
    const startIndex = getTimeSlotIndex(startSlot);
    if (startIndex === -1) return false;

    // Check if we have enough consecutive slots
    if (startIndex + duration > timeSlots.length) return false;

    const bookedSlots = bookedTimeSlots[courtId] || [];

    // Check each slot for availability
    for (let i = 0; i < duration; i++) {
        const slot = getTimeSlotAtIndex(startIndex + i);
        if (!slot) return false;

        // Check if slot is already booked
        if (bookedSlots.includes(slot)) {
            return false;
        }
    }

    return true;
}
