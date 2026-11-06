/// <reference path="../types/courtbook.d.ts" />
/**
 * CourtBook Pro — Championship Reactive Booking Engine
 * Architecture:
 * - Reactive State Store with Proxy-driven observation & subscription
 * - Client-Side Optimistic UI Updates with automatic state rollback on conflict
 * - Full TypeScript / JSDoc type safety
 * - Zero-latency client-side dynamic pricing calculation
 */

/**
 * @typedef {import('../types/courtbook').Court} Court
 * @typedef {import('../types/courtbook').Coach} Coach
 * @typedef {import('../types/courtbook').Equipment} Equipment
 * @typedef {import('../types/courtbook').PricingRulesMap} PricingRulesMap
 * @typedef {import('../types/courtbook').Booking} Booking
 * @typedef {import('../types/courtbook').BookingState} BookingStateType
 */

/**
 * Helper to get local date string YYYY-MM-DD
 * @param {Date} [d=new Date()]
 * @returns {string}
 */
function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Modern Reactive State Store with Proxy Mutation Tracking
 */
class ReactiveBookingStore {
    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this.subscribers = new Map();
        
        /** @type {BookingStateType} */
        const rawState = {
            date: getLocalDateString(new Date()),
            duration: 1,
            selectedCourt: null,
            selectedSlot: null,
            selectedCoach: null,
            equipmentRequests: {},
            courts: [],
            coaches: [],
            equipment: [],
            timeSlots: [],
            pricingRules: {},
            bookedCourtSlots: {},
            equipmentAvailability: {},
            optimisticLock: null
        };

        const self = this;
        this.state = new Proxy(rawState, {
            set(target, prop, value) {
                const oldVal = target[prop];
                target[prop] = value;
                if (oldVal !== value) {
                    self._notify(String(prop), value, oldVal);
                }
                return true;
            }
        });
    }

    /**
     * Subscribe to state mutations
     * @param {string} prop
     * @param {Function} callback
     * @returns {Function} Unsubscribe handler
     */
    subscribe(prop, callback) {
        if (!this.subscribers.has(prop)) {
            this.subscribers.set(prop, new Set());
        }
        this.subscribers.get(prop).add(callback);
        return () => this.subscribers.get(prop)?.delete(callback);
    }

    /**
     * Notify listeners of state change
     * @private
     */
    _notify(prop, val, oldVal) {
        const propListeners = this.subscribers.get(prop);
        if (propListeners) {
            propListeners.forEach(cb => cb(val, oldVal, prop));
        }
        const wildcardListeners = this.subscribers.get('*');
        if (wildcardListeners) {
            wildcardListeners.forEach(cb => cb(val, oldVal, prop));
        }
    }

    /**
     * Creates an immutable deep snapshot for optimistic rollback
     * @returns {Object}
     */
    createSnapshot() {
        return {
            selectedSlot: this.state.selectedSlot,
            selectedCourt: this.state.selectedCourt ? { ...this.state.selectedCourt } : null,
            equipmentRequests: { ...this.state.equipmentRequests },
            equipmentAvailability: { ...this.state.equipmentAvailability },
            bookedCourtSlots: JSON.parse(JSON.stringify(this.state.bookedCourtSlots)),
            optimisticLock: this.state.optimisticLock ? { ...this.state.optimisticLock } : null
        };
    }

    /**
     * Restores state from a previous snapshot (used on 409 conflict or network failure)
     * @param {Object} snapshot
     */
    restoreSnapshot(snapshot) {
        this.state.selectedSlot = snapshot.selectedSlot;
        this.state.selectedCourt = snapshot.selectedCourt;
        this.state.equipmentRequests = snapshot.equipmentRequests;
        this.state.equipmentAvailability = snapshot.equipmentAvailability;
        this.state.bookedCourtSlots = snapshot.bookedCourtSlots;
        this.state.optimisticLock = null;
    }
}

// Global reactive store instance
const store = new ReactiveBookingStore();
// Backward-compatibility alias for legacy scripts
const bookingState = store.state;

/**
 * Initialize on page load
 */
document.addEventListener('DOMContentLoaded', async () => {
    initDatePicker();
    setupReactiveSubscriptions();
    await loadBootstrapData();
});

/**
 * Configure reactive subscriptions to decouple state mutations from manual render calls
 */
function setupReactiveSubscriptions() {
    // When date or duration changes, update badge & availability
    store.subscribe('date', () => updateDateBadge());
    store.subscribe('duration', () => {
        if (store.state.selectedCourt) renderTimeSlots();
        updateSummary();
    });

    // When courts list updates, re-render court cards
    store.subscribe('courts', () => renderCourts());

    // When selected court changes, render slots & update price summary
    store.subscribe('selectedCourt', () => {
        renderCourts();
        renderTimeSlots();
        updateSummary();
    });

    // When selected slot changes, update slots highlight & price summary
    store.subscribe('selectedSlot', () => {
        renderTimeSlots();
        updateSummary();
    });

    // When coach selection changes, update coaches highlight & price summary
    store.subscribe('selectedCoach', () => {
        renderCoaches();
        updateSummary();
    });

    // When equipment availability changes, refresh stock labels
    store.subscribe('equipmentAvailability', () => updateEquipmentStockLabels());
}

/**
 * Initialize the date picker with today's date
 */
function initDatePicker() {
    const datePicker = /** @type {HTMLInputElement|null} */ (document.getElementById('bookingDate'));
    if (datePicker) {
        const todayStr = getLocalDateString(new Date());
        datePicker.value = todayStr;
        datePicker.min = todayStr;
        store.state.date = todayStr;
        updateDateBadge();
    }
}

/**
 * Update the schedule status badge
 */
function updateDateBadge() {
    const badge = document.getElementById('date-preview-badge');
    if (!badge || !store.state.date) return;

    const todayStr = getLocalDateString(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getLocalDateString(tomorrow);

    if (store.state.date === todayStr) {
        badge.textContent = "Today's Schedule";
        badge.className = 'badge-pro badge-status-open';
    } else if (store.state.date === tomorrowStr) {
        badge.textContent = "Tomorrow's Schedule";
        badge.className = 'badge-pro badge-admin-manga';
    } else {
        const d = new Date(store.state.date + 'T00:00:00');
        const formatted = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        badge.textContent = formatted + ' Schedule';
        badge.className = 'badge-pro badge-member-manga';
    }
}

/**
 * Loads consolidated bootstrap resource payload in 1 roundtrip
 */
async function loadBootstrapData() {
    try {
        const data = await ApiClient.get(`/api/bootstrap?date=${store.state.date}`);
        store.state.courts = data.courts || [];
        store.state.coaches = data.coaches || [];
        store.state.equipment = data.equipment || [];
        store.state.timeSlots = data.timeSlots || [];
        store.state.pricingRules = data.pricingRules || {};

        const availability = data.availability || {};
        store.state.bookedCourtSlots = availability.booked_time_slots || availability.booked_courts || {};
        store.state.equipmentAvailability = availability.equipment_availability || {};

        renderCourts();
        renderCoaches();
        renderEquipment();
        if (store.state.selectedCourt) {
            renderTimeSlots();
        }
        updateEquipmentStockLabels();
    } catch (err) {
        console.warn('Bootstrap endpoint failed, falling back to legacy loaders:', err);
        await loadInitialResources();
        await refreshAvailability();
    }
}

/**
 * Fallback initial resource loader
 */
async function loadInitialResources() {
    try {
        const [courts, coaches, equipment, slots] = await Promise.all([
            ApiClient.get('/api/courts'),
            ApiClient.get('/api/coaches'),
            ApiClient.get('/api/equipment'),
            ApiClient.get('/api/timeslots')
        ]);

        store.state.courts = Array.isArray(courts) ? courts : (courts && courts.data ? courts.data : []);
        store.state.coaches = Array.isArray(coaches) ? coaches : (coaches && coaches.data ? coaches.data : []);
        store.state.equipment = Array.isArray(equipment) ? equipment : (equipment && equipment.data ? equipment.data : []);
        store.state.timeSlots = Array.isArray(slots) ? slots : (slots && slots.data ? slots.data : []);
        renderCourts();
        renderCoaches();
        renderEquipment();
    } catch (err) {
        ApiClient.showToast('Failed to load court resources. Please refresh.', 'error');
    }
}

/**
 * Refresh availability from server
 */
async function refreshAvailability() {
    try {
        const availability = await ApiClient.get(`/api/check_availability?date=${store.state.date}`);
        store.state.bookedCourtSlots = availability.booked_time_slots || availability.booked_courts || {};
        store.state.equipmentAvailability = availability.equipment_availability || {};
        
        renderCourts();
        if (store.state.selectedCourt) {
            renderTimeSlots();
        }
        updateEquipmentStockLabels();
    } catch (err) {
        console.error('Error loading slot availability:', err);
    }
}

/**
 * Handle date or duration picker changes
 */
function onDateOrDurationChange() {
    const dateInput = /** @type {HTMLInputElement|null} */ (document.getElementById('bookingDate'));
    const durationInput = /** @type {HTMLSelectElement|null} */ (document.getElementById('bookingDuration'));
    if (dateInput) store.state.date = dateInput.value;
    if (durationInput) store.state.duration = parseInt(durationInput.value, 10);
    
    updateDateBadge();

    // Reset slot selection on date/duration change
    store.state.selectedSlot = null;
    refreshAvailability().then(() => {
        updateSummary();
    });
}

/**
 * Render court selection cards
 */
function renderCourts() {
    const container = document.getElementById('courts-grid');
    if (!container) return;

    container.innerHTML = store.state.courts.map(court => {
        const isSelected = store.state.selectedCourt && store.state.selectedCourt.id === court.id;
        const courtBookedSlots = store.state.bookedCourtSlots[court.id] || store.state.bookedCourtSlots[String(court.id)] || [];
        const isFullyBooked = store.state.timeSlots.length > 0 && courtBookedSlots.length >= store.state.timeSlots.length;

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

/**
 * Select a court
 * @param {number} courtId
 */
function selectCourt(courtId) {
    const court = store.state.courts.find(c => c.id === courtId);
    if (!court) return;

    store.state.selectedCourt = court;
    store.state.selectedSlot = null; // reset slot
}

/**
 * Helper to compute consecutive slots for duration
 * @param {string} startSlot
 * @param {number} duration
 * @returns {string[]}
 */
function getSlotsForDuration(startSlot, duration) {
    const idx = store.state.timeSlots.indexOf(startSlot);
    if (idx === -1 || idx + duration > store.state.timeSlots.length) return [];
    return store.state.timeSlots.slice(idx, idx + duration);
}

/**
 * Render time slots with optimistic and conflict state visualization
 */
function renderTimeSlots() {
    const container = document.getElementById('slots-container');
    if (!container || !store.state.selectedCourt) return;

    const courtId = store.state.selectedCourt.id;
    const bookedSlots = store.state.bookedCourtSlots[courtId] || store.state.bookedCourtSlots[String(courtId)] || [];

    const now = new Date();
    const todayStr = getLocalDateString(now);
    const isToday = (store.state.date === todayStr);
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    const slotChips = store.state.timeSlots.map((slot, idx) => {
        let hasConflict = false;
        let isPast = false;
        let isOptimisticallyLocked = false;

        // Check if slot has already elapsed today
        if (isToday) {
            const [sHour, sMin] = slot.split(':').map(Number);
            if (sHour < currentHour || (sHour === currentHour && currentMin > 0)) {
                isPast = true;
                hasConflict = true;
            }
        }

        // Check duration bounds and booked overlaps
        if (idx + store.state.duration > store.state.timeSlots.length) {
            hasConflict = true;
        } else if (!isPast) {
            for (let i = 0; i < store.state.duration; i++) {
                const subSlot = store.state.timeSlots[idx + i];
                if (bookedSlots.includes(subSlot)) {
                    hasConflict = true;
                    // Detect if this is an active optimistic reservation
                    if (store.state.optimisticLock && 
                        store.state.optimisticLock.courtId === courtId &&
                        store.state.optimisticLock.slot === subSlot) {
                        isOptimisticallyLocked = true;
                    }
                    break;
                }
            }
        }

        const isSelected = store.state.selectedSlot === slot;
        let statusLabel = '';
        if (isOptimisticallyLocked) {
            statusLabel = '⚡ Reserving...';
        } else if (isPast) {
            statusLabel = 'Past';
        } else if (hasConflict) {
            statusLabel = 'Booked';
        }

        return `
            <button type="button" 
                    class="slot-chip-pro ${hasConflict ? 'booked' : ''} ${isSelected ? 'selected' : ''} ${isOptimisticallyLocked ? 'optimistic-locking' : ''}"
                    ${hasConflict ? 'disabled' : ''}
                    onclick="selectTimeSlot('${slot}')">
                <span>${slot}</span>
                ${statusLabel ? `<span style="font-size: 0.65rem; opacity: 0.7; display: block; margin-top: 2px;">${statusLabel}</span>` : ''}
            </button>
        `;
    }).join('');

    container.innerHTML = `
        <div class="slots-grid-pro">
            ${slotChips}
        </div>
    `;
}

/**
 * Select a start time slot
 * @param {string} slot
 */
function selectTimeSlot(slot) {
    store.state.selectedSlot = slot;
}

/**
 * Render coaching staff options
 */
function renderCoaches() {
    const container = document.getElementById('coaches-grid');
    if (!container) return;

    container.innerHTML = `
        <div class="court-tile-pro ${store.state.selectedCoach === null ? 'selected' : ''}"
             onclick="selectCoach(null)" style="padding: 16px;">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 4px;">No Personal Coach</div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">Independent practice session</div>
        </div>
    ` + store.state.coaches.map(coach => {
        const isSelected = store.state.selectedCoach && store.state.selectedCoach.id === coach.id;
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

/**
 * Select coach by ID
 * @param {number|null} coachId
 */
function selectCoach(coachId) {
    if (coachId === null) {
        store.state.selectedCoach = null;
    } else {
        store.state.selectedCoach = store.state.coaches.find(c => c.id === coachId) || null;
    }
}

/**
 * Render equipment rental inventory
 */
function renderEquipment() {
    const container = document.getElementById('equipment-grid');
    if (!container) return;

    container.innerHTML = store.state.equipment.map(item => {
        const currentQty = store.state.equipmentRequests[item.id] || 0;
        const available = store.state.equipmentAvailability[item.id] !== undefined 
            ? store.state.equipmentAvailability[item.id] 
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

/**
 * Adjust equipment requested quantity
 * @param {number} equipId
 * @param {number} delta
 */
function changeEquipmentQty(equipId, delta) {
    const current = store.state.equipmentRequests[equipId] || 0;
    const item = store.state.equipment.find(e => e.id === equipId);
    const available = store.state.equipmentAvailability[equipId] !== undefined 
        ? store.state.equipmentAvailability[equipId] 
        : (item ? item.total_available : 10);

    const nextVal = Math.max(0, Math.min(available, current + delta));
    store.state.equipmentRequests = {
        ...store.state.equipmentRequests,
        [equipId]: nextVal
    };
    
    const qtyElem = document.getElementById(`eq-qty-${equipId}`);
    if (qtyElem) qtyElem.textContent = String(nextVal);

    debouncedUpdateSummary();
}

let updateSummaryDebounceTimer = null;
function debouncedUpdateSummary(delay = 150) {
    if (updateSummaryDebounceTimer) clearTimeout(updateSummaryDebounceTimer);
    updateSummaryDebounceTimer = setTimeout(() => {
        updateSummary();
    }, delay);
}

/**
 * Update stock counts on screen
 */
function updateEquipmentStockLabels() {
    store.state.equipment.forEach(item => {
        const avail = store.state.equipmentAvailability[item.id] !== undefined
            ? store.state.equipmentAvailability[item.id]
            : item.total_available;
        const stockElem = document.getElementById(`eq-stock-${item.id}`);
        if (stockElem) stockElem.textContent = String(avail);
    });
}

/**
 * ⚡ Instant 0ms Client-Side Price Calculation Engine
 * Replicates server pricing rules locally for instant feedback before server confirmation
 * @returns {number|null}
 */
function calculateLocalPricePreview() {
    if (!store.state.selectedCourt || !store.state.selectedSlot) return null;

    const court = store.state.selectedCourt;
    const duration = store.state.duration || 1;
    const coach = store.state.selectedCoach;
    const rules = store.state.pricingRules || {};

    let courtSubtotal = (court.base_price || 0) * duration;
    
    // Indoor multiplier
    if (court.type === 'indoor' && rules.indoor && rules.indoor.enabled) {
        courtSubtotal *= (rules.indoor.multiplier || 1.2);
    }

    // Weekend multiplier
    const d = new Date(store.state.date + 'T00:00:00');
    const dayOfWeek = d.getDay();
    if ((dayOfWeek === 0 || dayOfWeek === 6) && rules.weekend && rules.weekend.enabled) {
        courtSubtotal *= (rules.weekend.multiplier || 1.3);
    }

    // Multi-hour discount
    if (duration > 1 && rules.multipleHours && rules.multipleHours.enabled) {
        const discountPerHour = rules.multipleHours.discountPerHour || rules.multipleHours.discount || 0.10;
        const totalDiscount = Math.min(0.50, discountPerHour * (duration - 1));
        courtSubtotal *= (1 - totalDiscount);
    }

    let coachSubtotal = 0;
    if (coach) {
        coachSubtotal = (coach.price || 0) * duration;
    }

    let equipSubtotal = 0;
    let totalEquipQty = 0;
    for (const [eqId, qty] of Object.entries(store.state.equipmentRequests)) {
        if (qty > 0) {
            const item = store.state.equipment.find(e => e.id === parseInt(eqId, 10));
            if (item) {
                equipSubtotal += (item.price || 0) * qty;
                totalEquipQty += qty;
            }
        }
    }

    // Equipment bundle discount
    if (rules.bundle && rules.bundle.enabled && totalEquipQty >= (rules.bundle.minItems || 3)) {
        const bundleDisc = rules.bundle.discount || 0.15;
        equipSubtotal *= (1 - bundleDisc);
    }

    return Math.round(courtSubtotal + coachSubtotal + equipSubtotal);
}

/**
 * Updates summary view with instant optimistic pricing + authoritative backend preview
 */
async function updateSummary() {
    const emptyBox = document.getElementById('summary-empty');
    const contentBox = document.getElementById('summary-content');

    if (!store.state.selectedCourt || !store.state.selectedSlot) {
        if (emptyBox) emptyBox.style.display = 'block';
        if (contentBox) contentBox.style.display = 'none';
        return;
    }

    if (emptyBox) emptyBox.style.display = 'none';
    if (contentBox) contentBox.style.display = 'block';

    document.getElementById('sum-court').textContent = store.state.selectedCourt.name;
    document.getElementById('sum-time').textContent = `${store.state.date} @ ${store.state.selectedSlot}`;
    document.getElementById('sum-duration').textContent = `${store.state.duration} Hour${store.state.duration > 1 ? 's' : ''}`;
    document.getElementById('sum-coach').textContent = store.state.selectedCoach ? store.state.selectedCoach.name : 'None';

    // ⚡ Instant 0ms optimistic estimate
    const localEst = calculateLocalPricePreview();
    if (localEst !== null) {
        document.getElementById('sum-total').textContent = `₹${localEst}`;
    }

    try {
        const preview = await ApiClient.post('/api/calculate-price', {
            court_id: store.state.selectedCourt.id,
            date: store.state.date,
            time_slot: store.state.selectedSlot,
            duration: store.state.duration,
            coach_id: store.state.selectedCoach ? store.state.selectedCoach.id : null,
            equipment: store.state.equipmentRequests
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
        console.error('Failed to preview authoritative price:', err);
    }
}

/**
 * ⚡ SUBMIT BOOKING WITH CLIENT-SIDE OPTIMISTIC UPDATES & ATOMIC ROLLBACK
 */
async function submitBooking() {
    if (!store.state.selectedCourt || !store.state.selectedSlot) {
        ApiClient.showToast('Please select a court and start time slot', 'error');
        return;
    }

    const court = store.state.selectedCourt;
    const startSlot = store.state.selectedSlot;
    const duration = store.state.duration;
    const bookingDate = store.state.date;
    const coach = store.state.selectedCoach;
    const equipRequests = { ...store.state.equipmentRequests };

    // 1. Snapshot state for instant rollback in case of conflict or network error
    const rollbackSnapshot = store.createSnapshot();

    // 2. OPTIMISTIC UPDATE:
    // Mark requested consecutive slots as booked in local state immediately
    const consecutive = getSlotsForDuration(startSlot, duration);
    const courtIdStr = String(court.id);
    const existingBooked = store.state.bookedCourtSlots[courtIdStr] || [];
    const optimisticBookedSlots = [...new Set([...existingBooked, ...consecutive])];

    // Decrement stock optimistically
    const nextStock = { ...store.state.equipmentAvailability };
    for (const [eqId, qty] of Object.entries(equipRequests)) {
        if (nextStock[eqId] !== undefined) {
            nextStock[eqId] = Math.max(0, nextStock[eqId] - qty);
        }
    }

    // Apply optimistic updates to reactive store
    store.state.optimisticLock = {
        courtId: court.id,
        slot: startSlot,
        date: bookingDate
    };
    store.state.bookedCourtSlots = {
        ...store.state.bookedCourtSlots,
        [courtIdStr]: optimisticBookedSlots
    };
    store.state.equipmentAvailability = nextStock;

    // Instantly update UI components
    renderTimeSlots();
    updateEquipmentStockLabels();

    const btn = document.getElementById('btnConfirmBooking');
    btn.disabled = true;
    btn.innerHTML = '<span>⚡ Securing Row Lock & Slots...</span>';

    try {
        const payload = {
            court_id: court.id,
            date: bookingDate,
            time_slot: startSlot,
            duration: duration,
            coach_id: coach ? coach.id : null,
            equipment: equipRequests
        };

        const result = await ApiClient.post('/api/bookings/create', payload);

        if (result.success) {
            const bookingId = result.booking_id || (result.data && result.data.booking_id);
            ApiClient.showToast(`Court Reserved! Match ID #${bookingId} 🏸`, 'success');

            // Finalize optimistic state
            store.state.optimisticLock = null;
            store.state.selectedSlot = null;
            store.state.equipmentRequests = {};
            store.state.selectedCoach = null;
            store.state.duration = 1;
            const durSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('bookingDuration'));
            if (durSelect) durSelect.value = '1';

            renderCoaches();
            renderEquipment();
            await refreshAvailability();
            updateSummary();

            setTimeout(() => switchMainTab('history'), 500);
        } else {
            // ROLLBACK: Revert optimistic state back to snapshot
            store.restoreSnapshot(rollbackSnapshot);
            renderTimeSlots();
            updateEquipmentStockLabels();
            updateSummary();
            ApiClient.showToast(result.message || 'Slot collision detected. Selection rolled back.', 'error');
        }
    } catch (err) {
        // ROLLBACK: Revert optimistic state back to snapshot
        store.restoreSnapshot(rollbackSnapshot);
        renderTimeSlots();
        updateEquipmentStockLabels();
        updateSummary();
        ApiClient.showToast(err.message || 'Concurrency conflict: slot was claimed by another player.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Smash & Reserve Court</span><span>⚡</span>';
    }
}

/**
 * Switch tabs between Reservation Hub and Match History
 * @param {'book'|'history'} tab
 */
function switchMainTab(tab) {
    const bookView = document.getElementById('view-book');
    const historyView = document.getElementById('view-history');
    
    const tabBook = document.getElementById('tab-book');
    const tabHistory = document.getElementById('tab-history');

    if (!bookView || !historyView || !tabBook || !tabHistory) return;

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

/**
 * Loads match history with optimistic row tracking
 */
async function loadBookingHistory() {
    const container = document.getElementById('history-container');
    if (!container) return;
    container.innerHTML = '<p style="color: var(--text-muted);">Loading your match records...</p>';

    try {
        const raw = await ApiClient.get('/api/bookings');
        /** @type {Booking[]} */
        const bookings = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.data) ? raw.data : []);
        
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
                            <tr id="booking-row-${b.id}">
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
                                    <span class="badge-pro ${b.status === 'confirmed' ? 'badge-status-open' : (b.status === 'completed' ? 'badge-admin-manga' : 'badge-status-busy')}">
                                        ${b.status === 'confirmed' ? '⚡ Confirmed' : (b.status === 'completed' ? '🏆 Completed' : '❌ Cancelled')}
                                    </span>
                                </td>
                                <td style="text-align: right;">
                                    ${b.status === 'confirmed' ? `
                                        <button class="btn-manga btn-manga-danger btn-manga-sm" onclick="cancelBooking(${b.id})">
                                            Cancel
                                        </button>
                                    ` : (b.status === 'completed' ? '<span style="color: var(--accent-green); font-size: 0.85rem; font-weight: 700;">Completed</span>' : '<span style="color: var(--text-dim); font-size: 0.85rem;">Released</span>')}
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

/**
 * ⚡ OPTIMISTIC BOOKING CANCELLATION WITH ROLLBACK
 * @param {number} bookingId
 */
async function cancelBooking(bookingId) {
    if (!confirm(`Cancel Match Booking #${bookingId}? Slot locks will be immediately released.`)) return;

    // OPTIMISTIC UPDATE: Transition row badge immediately to releasing state
    const row = document.getElementById(`booking-row-${bookingId}`);
    let oldBadgeHtml = '';
    if (row) {
        const badge = row.querySelector('.badge-pro');
        if (badge) {
            oldBadgeHtml = badge.outerHTML;
            badge.className = 'badge-pro badge-status-busy';
            badge.innerHTML = '⏳ Releasing...';
        }
    }

    try {
        const result = await ApiClient.post(`/api/bookings/${bookingId}/cancel`);
        if (result.success) {
            ApiClient.showToast(`Booking #${bookingId} cancelled successfully.`, 'info');
            await refreshAvailability();
            loadBookingHistory();
        } else {
            // Rollback optimistic badge
            if (row && oldBadgeHtml) {
                const badge = row.querySelector('.badge-pro');
                if (badge) badge.outerHTML = oldBadgeHtml;
            }
            ApiClient.showToast(result.message || 'Failed to cancel booking.', 'error');
        }
    } catch (err) {
        // Rollback optimistic badge
        if (row && oldBadgeHtml) {
            const badge = row.querySelector('.badge-pro');
            if (badge) badge.outerHTML = oldBadgeHtml;
        }
        ApiClient.showToast(err.message || 'Error cancelling booking.', 'error');
    }
}
