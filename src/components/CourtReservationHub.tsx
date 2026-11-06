import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BootstrapData,
  Court,
  Coach,
  Equipment,
  PriceCalculation,
  User,
} from '../types';
import { api } from '../services/api';
import { useToast } from './Toast';
import {
  Calendar,
  Clock,
  Sparkles,
  Zap,
  Check,
  Lock,
  ChevronRight,
  Shield,
  Layers,
  Award,
  AlertCircle,
  Plus,
  Minus,
} from 'lucide-react';

interface CourtReservationHubProps {
  user: User | null;
  onOpenAuth?: () => void;
  onAuthRequired?: () => void;
  onBookingCreated: () => void;
  showToast?: (type: any, titleOrMsg: string, desc?: string) => void;
}

export const CourtReservationHub: React.FC<CourtReservationHubProps> = ({
  user,
  onOpenAuth,
  onAuthRequired,
  onBookingCreated,
  showToast: propShowToast,
}) => {
  const toastCtx = useToast();
  const showToast = propShowToast || toastCtx.showToast;
  const triggerAuth = onOpenAuth || onAuthRequired || (() => {});

  // State
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Default to tomorrow
    return d.toISOString().split('T')[0];
  });
  const [duration, setDuration] = useState<number>(1);
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);
  const [equipmentQuantities, setEquipmentQuantities] = useState<Record<number, number>>({});

  // Remote data state
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(false);
  const [priceCalc, setPriceCalc] = useState<PriceCalculation | null>(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load Bootstrap Data on Date Change
  const loadBootstrap = useCallback(async (targetDate: string) => {
    setLoadingBootstrap(true);
    try {
      const data = await api.getBootstrap(targetDate);
      setBootstrap(data);
      // Auto-select first active court if not selected
      if (!selectedCourtId && data.courts?.length > 0) {
        setSelectedCourtId(data.courts[0].id);
      }
    } catch (err: any) {
      showToast('error', 'Failed to load court schedules', err.message);
    } finally {
      setLoadingBootstrap(false);
    }
  }, [selectedCourtId, showToast]);

  useEffect(() => {
    loadBootstrap(date);
  }, [date, loadBootstrap]);

  // Real-time server-side price calculation
  useEffect(() => {
    if (!selectedCourtId || !selectedSlot) {
      setPriceCalc(null);
      return;
    }

    let isMounted = true;
    setCalculatingPrice(true);

    api
      .calculatePrice({
        court_id: selectedCourtId,
        date,
        time_slot: selectedSlot,
        duration,
        coach_id: selectedCoachId,
        equipment_requests: equipmentQuantities,
      })
      .then((calc) => {
        if (isMounted) setPriceCalc(calc);
      })
      .catch((err) => {
        console.warn('Price calculation failed:', err);
      })
      .finally(() => {
        if (isMounted) setCalculatingPrice(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCourtId, date, selectedSlot, duration, selectedCoachId, equipmentQuantities]);

  // Quick Date Helpers
  const setQuickDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setDate(d.toISOString().split('T')[0]);
    setSelectedSlot(null);
  };

  // Courts list
  const courts = bootstrap?.courts || [];
  const coaches = bootstrap?.coaches || [];
  const equipment = bootstrap?.equipment || [];
  const timeSlots = bootstrap?.timeSlots || [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00'
  ];

  // Booked slots for selected court
  const bookedCourtSlots = useMemo(() => {
    if (!bootstrap?.availability?.booked_slots || !selectedCourtId) return new Set<string>();
    const courtSlots = bootstrap.availability.booked_slots[selectedCourtId] || [];
    return new Set(courtSlots);
  }, [bootstrap, selectedCourtId]);

  // Booked slots for selected coach
  const bookedCoachSlots = useMemo(() => {
    if (!bootstrap?.availability?.coach_booked_slots || !selectedCoachId) return new Set<string>();
    const coachSlots = bootstrap.availability.coach_booked_slots[selectedCoachId] || [];
    return new Set(coachSlots);
  }, [bootstrap, selectedCoachId]);

  // Determine if a slot has enough consecutive hours available
  const isSlotAvailableForDuration = (startSlot: string): boolean => {
    const startIndex = timeSlots.indexOf(startSlot);
    if (startIndex === -1 || startIndex + duration > timeSlots.length) {
      return false;
    }
    for (let i = 0; i < duration; i++) {
      const slotToCheck = timeSlots[startIndex + i];
      if (bookedCourtSlots.has(slotToCheck)) return false;
      if (selectedCoachId && bookedCoachSlots.has(slotToCheck)) return false;
    }
    return true;
  };

  // Group slots into time-of-day blocks
  const morningSlots = timeSlots.filter((s) => parseInt(s) < 12);
  const afternoonSlots = timeSlots.filter((s) => parseInt(s) >= 12 && parseInt(s) < 17);
  const eveningSlots = timeSlots.filter((s) => parseInt(s) >= 17);

  // Equipment quantity handlers
  const updateEquipQty = (id: number, delta: number, max: number) => {
    setEquipmentQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, Math.min(max, current + delta));
      return { ...prev, [id]: next };
    });
  };

  // Total equipment items for bundle discount callout
  const totalEquipItems = Object.values(equipmentQuantities).reduce((a, b) => a + b, 0);

  // Submit Booking with Optimistic Locking
  const handleReserve = async () => {
    if (!user) {
      triggerAuth();
      return;
    }
    if (!selectedCourtId || !selectedSlot) {
      showToast('warning', 'Incomplete Selection', 'Please choose a court and a starting time slot.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createBooking({
        court_id: selectedCourtId,
        date,
        time_slot: selectedSlot,
        duration,
        coach_id: selectedCoachId,
        equipment_requests: equipmentQuantities,
        client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      showToast('success', 'Court Reserved Successfully!', `Booked for ${duration} hour(s) on ${date} at ${selectedSlot}.`);
      setSelectedSlot(null);
      setEquipmentQuantities({});
      setSelectedCoachId(null);
      loadBootstrap(date);
      onBookingCreated();
    } catch (err: any) {
      showToast('error', 'Booking Conflict', err.message || 'Could not complete reservation.');
      loadBootstrap(date);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 28, alignItems: 'start' }}>
      
      {/* Left Column: Step-by-Step Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Step 1: Date & Duration */}
        <section className="next-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge-next badge-next-orange">Step 1</span>
                <h3 style={{ fontSize: '1.25rem', color: '#ffffff' }}>Date & Duration</h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Multi-hour sessions unlock automatic tiered bundle discounts
              </p>
            </div>

            {/* Quick Date Pills */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setQuickDate(0)}
                className="btn-next btn-next-sm btn-next-secondary"
                style={{ fontSize: '0.78rem' }}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(1)}
                className="btn-next btn-next-sm btn-next-secondary"
                style={{ fontSize: '0.78rem' }}
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(2)}
                className="btn-next btn-next-sm btn-next-secondary"
                style={{ fontSize: '0.78rem' }}
              >
                In 2 Days
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Match Date
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  className="next-input"
                  value={date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSelectedSlot(null);
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Duration
              </label>
              <select
                className="next-input"
                value={duration}
                onChange={(e) => {
                  setDuration(parseInt(e.target.value));
                  setSelectedSlot(null);
                }}
              >
                <option value={1}>1 Hour (Standard Rate)</option>
                <option value={2}>2 Hours (⚡ 10% Multi-Hour Discount)</option>
                <option value={3}>3 Hours (⚡ 20% Multi-Hour Discount)</option>
                <option value={4}>4 Hours (⚡ 30% Multi-Hour Discount)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Step 2: Court Selection Cards */}
        <section className="next-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge-next badge-next-orange">Step 2</span>
                <h3 style={{ fontSize: '1.25rem', color: '#ffffff' }}>Choose Court</h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4 }}>
                BWF Certified Championship synthetic and teakwood courts
              </p>
            </div>
            <span className="badge-next badge-next-emerald">{courts.length} Courts Available</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {courts.map((court) => {
              const isSelected = selectedCourtId === court.id;
              const isIndoor = court.type === 'indoor';

              return (
                <div
                  key={court.id}
                  onClick={() => {
                    setSelectedCourtId(court.id);
                    setSelectedSlot(null);
                  }}
                  className={`next-card next-card-interactive ${isSelected ? 'next-card-selected' : ''}`}
                  style={{ padding: 18 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <span className={`badge-next ${isIndoor ? 'badge-next-purple' : 'badge-next-orange'}`}>
                      {isIndoor ? 'Indoor Synthetic' : 'Outdoor Teak'}
                    </span>
                    {isSelected && (
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: 'var(--orange-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                        }}
                      >
                        <Check size={14} />
                      </div>
                    )}
                  </div>

                  <h4 style={{ fontSize: '1.05rem', color: '#ffffff', marginBottom: 4 }}>{court.name}</h4>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 14 }}>
                    {isIndoor ? 'Shock-absorbent BWF Grade' : 'All-weather non-slip surface'}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--orange-primary)' }}>
                      ₹{court.base_price || court.basePrice}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>/ hour</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Step 3: Time Slot Matrix */}
        <section className="next-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge-next badge-next-orange">Step 3</span>
                <h3 style={{ fontSize: '1.25rem', color: '#ffffff' }}>Select Time Slot</h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Atomic database row locking guarantees zero double-bookings
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.78rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(255,255,255,0.1)' }} /> Available
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--orange-primary)' }} /> Selected
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#ef4444', opacity: 0.5 }} /> Booked
              </span>
            </div>
          </div>

          {/* Group 1: Morning */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Morning Sessions (06:00 - 12:00)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
              {morningSlots.map((slot) => {
                const available = isSlotAvailableForDuration(slot);
                const isSelected = selectedSlot === slot;
                const isBooked = bookedCourtSlots.has(slot);

                return (
                  <div
                    key={slot}
                    onClick={() => available && setSelectedSlot(slot)}
                    className={`slot-chip ${isSelected ? 'slot-selected' : ''} ${!available ? (isBooked ? 'slot-booked' : 'slot-past') : ''}`}
                  >
                    <div>{slot}</div>
                    {isSelected && <span style={{ fontSize: '0.68rem', marginTop: 2 }}>{duration}h Res</span>}
                    {isBooked && <Lock size={12} style={{ marginTop: 2 }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Group 2: Afternoon */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Afternoon Sessions (12:00 - 17:00)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
              {afternoonSlots.map((slot) => {
                const available = isSlotAvailableForDuration(slot);
                const isSelected = selectedSlot === slot;
                const isBooked = bookedCourtSlots.has(slot);

                return (
                  <div
                    key={slot}
                    onClick={() => available && setSelectedSlot(slot)}
                    className={`slot-chip ${isSelected ? 'slot-selected' : ''} ${!available ? (isBooked ? 'slot-booked' : 'slot-past') : ''}`}
                  >
                    <div>{slot}</div>
                    {isSelected && <span style={{ fontSize: '0.68rem', marginTop: 2 }}>{duration}h Res</span>}
                    {isBooked && <Lock size={12} style={{ marginTop: 2 }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Group 3: Evening Peak */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Evening Peak Hours (17:00 - 22:00)
              </div>
              <span className="badge-next badge-next-orange" style={{ fontSize: '0.68rem' }}>⚡ Peak 1.5x Multiplier</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
              {eveningSlots.map((slot) => {
                const available = isSlotAvailableForDuration(slot);
                const isSelected = selectedSlot === slot;
                const isBooked = bookedCourtSlots.has(slot);

                return (
                  <div
                    key={slot}
                    onClick={() => available && setSelectedSlot(slot)}
                    className={`slot-chip ${isSelected ? 'slot-selected' : ''} ${!available ? (isBooked ? 'slot-booked' : 'slot-past') : ''}`}
                  >
                    <div>{slot}</div>
                    {isSelected && <span style={{ fontSize: '0.68rem', marginTop: 2 }}>{duration}h Res</span>}
                    {isBooked && <Lock size={12} style={{ marginTop: 2 }} />}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Step 4: Certified Coaches (Optional) */}
        <section className="next-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge-next badge-next-dim">Optional</span>
                <h3 style={{ fontSize: '1.25rem', color: '#ffffff' }}>Championship Coach Training</h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4 }}>
                1-on-1 technical drills, footwork conditioning, and match play coaching
              </p>
            </div>
            {selectedCoachId && (
              <button
                type="button"
                onClick={() => setSelectedCoachId(null)}
                className="btn-next btn-next-sm btn-next-secondary"
                style={{ fontSize: '0.78rem' }}
              >
                Clear Coach
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {coaches.map((coach) => {
              const isSelected = selectedCoachId === coach.id;
              return (
                <div
                  key={coach.id}
                  onClick={() => setSelectedCoachId(isSelected ? null : coach.id)}
                  className={`next-card next-card-interactive ${isSelected ? 'next-card-selected' : ''}`}
                  style={{ padding: 16 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span className="badge-next badge-next-orange">{coach.specialization}</span>
                    {isSelected && (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          background: 'var(--orange-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                        }}
                      >
                        <Check size={12} />
                      </div>
                    )}
                  </div>
                  <h4 style={{ fontSize: '1rem', color: '#ffffff', marginBottom: 4 }}>{coach.name}</h4>
                  <div style={{ fontSize: '0.85rem', color: 'var(--orange-primary)', fontWeight: 700 }}>
                    +₹{coach.price} <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>/ hour</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Step 5: Equipment Rentals */}
        <section className="next-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge-next badge-next-dim">Optional</span>
                <h3 style={{ fontSize: '1.25rem', color: '#ffffff' }}>Equipment Rental & Gear</h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Tournament-grade carbon graphite rackets, feather shuttlecocks, and court footwear
              </p>
            </div>
            {totalEquipItems >= 3 && (
              <span className="badge-next badge-next-emerald">⚡ 15% Bundle Discount Applied!</span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {equipment.map((item) => {
              const qty = equipmentQuantities[item.id] || 0;
              const maxStock = item.total_available || item.totalAvailable || 10;

              return (
                <div
                  key={item.id}
                  className="next-card"
                  style={{
                    padding: 16,
                    borderColor: qty > 0 ? 'var(--orange-primary)' : 'var(--border-subtle)',
                    background: qty > 0 ? 'rgba(249, 115, 22, 0.04)' : 'var(--bg-surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <h4 style={{ fontSize: '0.98rem', color: '#ffffff' }}>{item.name}</h4>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--orange-primary)' }}>₹{item.price}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 14 }}>
                    {maxStock} units in stock
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Quantity:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => updateEquipQty(item.id, -1, maxStock)}
                        disabled={qty === 0}
                        className="btn-next btn-next-sm btn-next-secondary"
                        style={{ padding: '4px 8px', borderRadius: 6 }}
                      >
                        <Minus size={14} />
                      </button>
                      <span style={{ fontWeight: 800, fontSize: '1rem', minWidth: 20, textAlign: 'center', color: '#ffffff' }}>
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateEquipQty(item.id, 1, maxStock)}
                        disabled={qty >= maxStock}
                        className="btn-next btn-next-sm btn-next-secondary"
                        style={{ padding: '4px 8px', borderRadius: 6 }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Right Column: Sticky Real-Time Pricing Summary */}
      <div style={{ position: 'sticky', top: 90 }}>
        <div
          className="next-card"
          style={{
            background: 'linear-gradient(180deg, #18181b 0%, #121215 100%)',
            borderColor: 'rgba(249, 115, 22, 0.4)',
            boxShadow: '0 12px 40px -8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(249, 115, 22, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: '#ffffff' }}>Match Estimate</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>Authoritative server-side calculation</p>
            </div>
            <span className="badge-next badge-next-orange">Live Pricing</span>
          </div>

          {/* Itemized Breakdown List */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '16px 0', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            
            {/* Match info row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Session:</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>
                {date} ({duration} hr{duration > 1 ? 's' : ''})
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Starting Time:</span>
              <span style={{ color: selectedSlot ? 'var(--orange-primary)' : 'var(--text-dim)', fontWeight: 600 }}>
                {selectedSlot ? `${selectedSlot} IST` : 'Not Selected'}
              </span>
            </div>

            {/* Price Breakdown from Backend */}
            {priceCalc?.breakdown && priceCalc.breakdown.length > 0 ? (
              priceCalc.breakdown.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: item.amount < 0 ? '#34d399' : 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ color: item.amount < 0 ? '#34d399' : '#ffffff', fontWeight: 600 }}>
                    {item.amount < 0 ? `-₹${Math.abs(item.amount)}` : `₹${item.amount}`}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '6px 0' }}>
                Select a court and start time to calculate breakdown.
              </div>
            )}
          </div>

          {/* Applied Rules Pills */}
          {priceCalc?.applied_rules && priceCalc.applied_rules.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 700 }}>
                Active Applied Rules
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {priceCalc.applied_rules.map((rule, idx) => (
                  <span key={idx} className="badge-next badge-next-emerald" style={{ fontSize: '0.72rem' }}>
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Total Price */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)' }}>Estimated Total</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
                ₹{priceCalc ? priceCalc.total_price || priceCalc.totalPrice : 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Includes GST & Court Access</div>
            </div>
          </div>

          {/* Submit Reservation Button */}
          <button
            type="button"
            onClick={handleReserve}
            disabled={submitting || !selectedSlot || !selectedCourtId}
            className="btn-next btn-next-primary btn-next-lg"
            style={{ width: '100%', height: 50 }}
          >
            {submitting ? (
              <span>⚡ Reserving with Row-Level Lock...</span>
            ) : (
              <>
                <Zap size={18} />
                <span>Confirm & Reserve Court</span>
              </>
            )}
          </button>

          {!user && (
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              🔒 You will be prompted to sign in to confirm this reservation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

