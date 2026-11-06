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
  Flame,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';

interface CourtReservationHubProps {
  user: User | null;
  onOpenAuth?: () => void;
  onAuthRequired?: () => void;
  onBookingCreated: () => void;
  showToast?: (type: any, titleOrMsg: string, desc?: string) => void;
  onQuickDemoLogin?: (role: 'admin' | 'player') => Promise<void>;
}

export const CourtReservationHub: React.FC<CourtReservationHubProps> = ({
  user,
  onOpenAuth,
  onAuthRequired,
  onBookingCreated,
  showToast: propShowToast,
  onQuickDemoLogin,
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

  // 7-Day Date Strip Generator
  const dateOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const monthName = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const dayNum = d.getDate();
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isToday = i === 0;
      const isTomorrow = i === 1;
      options.push({
        dateStr,
        dayName: isToday ? 'TODAY' : isTomorrow ? 'TOMORROW' : dayName,
        monthName,
        dayNum,
        isWeekend,
      });
    }
    return options;
  }, []);

  // Load Bootstrap Data on Date Change
  const loadBootstrap = useCallback(async (targetDate: string) => {
    setLoadingBootstrap(true);
    try {
      const data = await api.getBootstrap(targetDate);
      setBootstrap(data);
      // Auto-select first active court if none selected
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

  // Courts, Coaches, Equipment, Slots from Bootstrap
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
    if (!bootstrap?.availability || !selectedCourtId) return new Set<string>();
    const avail = bootstrap.availability as any;
    const courtSlots = avail.booked_slots?.[selectedCourtId] || avail.booked_time_slots?.[selectedCourtId] || [];
    return new Set<string>(courtSlots);
  }, [bootstrap, selectedCourtId]);

  // Booked slots for selected coach
  const bookedCoachSlots = useMemo(() => {
    if (!bootstrap?.availability || !selectedCoachId) return new Set<string>();
    const avail = bootstrap.availability as any;
    const coachSlots = avail.coach_booked_slots?.[selectedCoachId] || [];
    return new Set<string>(coachSlots);
  }, [bootstrap, selectedCoachId]);

  // Determine if a starting slot has enough consecutive hours available
  const isSlotAvailableForDuration = useCallback((startSlot: string): boolean => {
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
  }, [timeSlots, duration, bookedCourtSlots, selectedCoachId, bookedCoachSlots]);

  // Auto-select first available slot when court, duration, or date changes
  useEffect(() => {
    if (!bootstrap || !selectedCourtId) return;

    if (selectedSlot && isSlotAvailableForDuration(selectedSlot)) {
      return;
    }

    const firstAvailable = timeSlots.find((s) => isSlotAvailableForDuration(s));
    if (firstAvailable) {
      setSelectedSlot(firstAvailable);
    }
  }, [bootstrap, selectedCourtId, duration, isSlotAvailableForDuration, timeSlots, selectedSlot]);

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
        equipment: equipmentQuantities,
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

  const totalEquipItems = Object.values(equipmentQuantities).reduce((a, b) => a + b, 0);

  // Submit Booking with Row Locking
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
        equipment: equipmentQuantities,
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

  // Quick Demo Player Reserve Handler
  const handleQuickDemoReserve = async () => {
    if (!selectedCourtId || !selectedSlot) {
      showToast('warning', 'Please pick a time slot first.');
      return;
    }
    if (onQuickDemoLogin) {
      setSubmitting(true);
      try {
        await onQuickDemoLogin('player');
        await api.createBooking({
          court_id: selectedCourtId,
          date,
          time_slot: selectedSlot,
          duration,
          coach_id: selectedCoachId,
          equipment_requests: equipmentQuantities,
          equipment: equipmentQuantities,
          client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        showToast('success', 'Reservation Confirmed via Demo Player!', `Slot locked for ${duration} hr(s) on ${date} at ${selectedSlot}.`);
        onBookingCreated();
      } catch (err: any) {
        showToast('error', 'Booking Error', err.message || 'Failed to complete quick demo booking.');
      } finally {
        setSubmitting(false);
      }
    } else {
      triggerAuth();
    }
  };

  const selectedCourt = courts.find((c) => c.id === selectedCourtId);
  const selectedCoach = coaches.find((c) => c.id === selectedCoachId);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px' }}>
      
      {/* Top Banner: Arena Status */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(90deg, rgba(249, 115, 22, 0.12) 0%, rgba(18, 18, 21, 0.8) 100%)',
          border: '1px solid rgba(249, 115, 22, 0.25)',
          borderRadius: 14,
          padding: '14px 20px',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(249, 115, 22, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--orange-primary)',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#ffffff' }}>
              Championship Badminton Arena — Live Slot Engine
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Atomic PostgreSQL Row-Level Locking (SELECT ... FOR UPDATE) • High Concurrency Protection
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge-next badge-next-emerald">🟢 Systems Operational</span>
          <span className="badge-next badge-next-dim">Neon PostgreSQL Cloud</span>
        </div>
      </div>

      {/* Main Two-Column Hub Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 390px', gap: 28, alignItems: 'start' }}>
        
        {/* Left Column: Flow Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* STEP 1: Date & Duration */}
          <section className="next-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge-next badge-next-orange">Step 1</span>
                  <h3 style={{ fontSize: '1.2rem', color: '#ffffff' }}>Date & Duration</h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Choose your match date and session duration for automatic tiered discounts
                </p>
              </div>

              {/* Custom Date Input for Any Future Date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Custom:</span>
                <input
                  type="date"
                  value={date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSelectedSlot(null);
                  }}
                  className="next-input"
                  style={{ padding: '6px 10px', fontSize: '0.82rem', width: 'auto', background: 'rgba(255,255,255,0.04)' }}
                />
              </div>
            </div>

            {/* 7-Day Interactive Date Strip */}
            <div className="date-carousel-container">
              {dateOptions.map((opt) => {
                const isActive = date === opt.dateStr;
                return (
                  <div
                    key={opt.dateStr}
                    onClick={() => {
                      setDate(opt.dateStr);
                      setSelectedSlot(null);
                    }}
                    className={`date-card ${isActive ? 'active' : ''}`}
                  >
                    {opt.isWeekend && <span className="weekend-dot">1.25x</span>}
                    <span className="day-label">{opt.dayName}</span>
                    <span className="day-number">{opt.dayNum}</span>
                    <span className="month-label">{opt.monthName}</span>
                  </div>
                );
              })}
            </div>

            {/* Duration Selector Segmented Pills */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                Session Duration & Volume Tier
              </div>
              <div className="duration-grid">
                <div
                  onClick={() => {
                    setDuration(1);
                    setSelectedSlot(null);
                  }}
                  className={`duration-pill ${duration === 1 ? 'active' : ''}`}
                >
                  <span className="duration-title">1 Hour</span>
                  <span className="duration-sub">Standard Rate</span>
                </div>

                <div
                  onClick={() => {
                    setDuration(2);
                    setSelectedSlot(null);
                  }}
                  className={`duration-pill ${duration === 2 ? 'active' : ''}`}
                >
                  <span className="duration-title">2 Hours</span>
                  <span className="duration-sub">⚡ 10% Discount</span>
                </div>

                <div
                  onClick={() => {
                    setDuration(3);
                    setSelectedSlot(null);
                  }}
                  className={`duration-pill ${duration === 3 ? 'active' : ''}`}
                >
                  <span className="duration-title">3 Hours</span>
                  <span className="duration-sub">⚡ 20% Discount</span>
                </div>

                <div
                  onClick={() => {
                    setDuration(4);
                    setSelectedSlot(null);
                  }}
                  className={`duration-pill ${duration === 4 ? 'active' : ''}`}
                >
                  <span className="duration-title">4 Hours</span>
                  <span className="duration-sub">⚡ 30% Best Value</span>
                </div>
              </div>
            </div>
          </section>

          {/* STEP 2: Choose Court */}
          <section className="next-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge-next badge-next-orange">Step 2</span>
                  <h3 style={{ fontSize: '1.2rem', color: '#ffffff' }}>Choose Court</h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  BWF Certified Championship synthetic and all-weather teakwood courts
                </p>
              </div>
              <span className="badge-next badge-next-emerald">{courts.length} Courts Available</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {courts.map((court) => {
                const isSelected = selectedCourtId === court.id;
                const isIndoor = court.type.toLowerCase() === 'indoor';

                return (
                  <div
                    key={court.id}
                    onClick={() => {
                      setSelectedCourtId(court.id);
                      setSelectedSlot(null);
                    }}
                    className={`court-item-card ${isSelected ? 'active' : ''}`}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span className={`badge-next ${isIndoor ? 'badge-next-purple' : 'badge-next-orange'}`}>
                          {isIndoor ? 'Indoor Synthetic' : 'Outdoor Teak'}
                        </span>
                        {isSelected && (
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: 'var(--orange-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              boxShadow: '0 2px 8px var(--orange-glow)',
                            }}
                          >
                            <Check size={14} />
                          </div>
                        )}
                      </div>

                      <h4 style={{ fontSize: '1.05rem', color: '#ffffff', marginBottom: 4 }}>{court.name}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 14 }}>
                        {isIndoor ? 'Shock-absorbent BWF Grade' : 'All-weather non-slip tournament teak'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--orange-primary)', fontFamily: 'var(--font-heading)' }}>
                        ₹{court.base_price || court.basePrice}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>/ hour</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* STEP 3: Time Slot Matrix */}
          <section className="next-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge-next badge-next-orange">Step 3</span>
                  <h3 style={{ fontSize: '1.2rem', color: '#ffffff' }}>Select Time Slot</h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Starting slot reserves {duration} consecutive hour{duration > 1 ? 's' : ''}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.76rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(255,255,255,0.1)' }} /> Available
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--orange-primary)' }} /> Selected
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: '#ef4444', opacity: 0.6 }} /> Booked
                </span>
              </div>
            </div>

            {/* Morning Slots */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Morning Sessions (06:00 – 12:00)
              </div>
              <div className="slot-grid-modern">
                {morningSlots.map((slot) => {
                  const available = isSlotAvailableForDuration(slot);
                  const isSelected = selectedSlot === slot;
                  const isBooked = bookedCourtSlots.has(slot);

                  return (
                    <div
                      key={slot}
                      onClick={() => available && setSelectedSlot(slot)}
                      className={`slot-item ${isSelected ? 'active' : ''} ${!available ? 'slot-disabled' : ''}`}
                    >
                      <span className="slot-time">{slot}</span>
                      <span className="slot-price-tag">
                        {isBooked ? 'Locked' : `₹${selectedCourt?.base_price || 600}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Afternoon Slots */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Afternoon Sessions (12:00 – 17:00)
              </div>
              <div className="slot-grid-modern">
                {afternoonSlots.map((slot) => {
                  const available = isSlotAvailableForDuration(slot);
                  const isSelected = selectedSlot === slot;
                  const isBooked = bookedCourtSlots.has(slot);

                  return (
                    <div
                      key={slot}
                      onClick={() => available && setSelectedSlot(slot)}
                      className={`slot-item ${isSelected ? 'active' : ''} ${!available ? 'slot-disabled' : ''}`}
                    >
                      <span className="slot-time">{slot}</span>
                      <span className="slot-price-tag">
                        {isBooked ? 'Locked' : `₹${selectedCourt?.base_price || 600}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Evening Peak Slots */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: '0.78rem', color: '#fb923c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Flame size={14} color="#f97316" /> Evening Peak Sessions (17:00 – 22:00)
                </div>
                <span className="badge-next badge-next-orange" style={{ fontSize: '0.68rem' }}>1.5x Multiplier</span>
              </div>
              <div className="slot-grid-modern">
                {eveningSlots.map((slot) => {
                  const available = isSlotAvailableForDuration(slot);
                  const isSelected = selectedSlot === slot;
                  const isBooked = bookedCourtSlots.has(slot);
                  const peakEst = Math.round((selectedCourt?.base_price || 600) * 1.5);

                  return (
                    <div
                      key={slot}
                      onClick={() => available && setSelectedSlot(slot)}
                      className={`slot-item ${isSelected ? 'active' : ''} ${!available ? 'slot-disabled' : ''}`}
                    >
                      <span className="slot-time">{slot}</span>
                      <span className="slot-price-tag">
                        {isBooked ? 'Locked' : `₹${peakEst} (Peak)`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* STEP 4: Certified Coaches (Optional) */}
          <section className="next-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge-next badge-next-dim">Optional</span>
                  <h3 style={{ fontSize: '1.2rem', color: '#ffffff' }}>Championship Coaching</h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  1-on-1 technical drills, footwork conditioning, and competitive tactics
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
                    className={`court-item-card ${isSelected ? 'active' : ''}`}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span className="badge-next badge-next-orange">{coach.specialization}</span>
                        {isSelected && (
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
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
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 12 }}>
                        BWF Certified Professional Training
                      </p>
                    </div>

                    <div style={{ fontSize: '0.9rem', color: 'var(--orange-primary)', fontWeight: 700, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                      +₹{coach.price} <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>/ hour</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* STEP 5: Equipment Rentals */}
          <section className="next-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge-next badge-next-dim">Optional</span>
                  <h3 style={{ fontSize: '1.2rem', color: '#ffffff' }}>Equipment Rental & Gear</h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Carbon graphite tournament rackets, feather shuttlecocks, and court footwear
                </p>
              </div>
              {totalEquipItems >= 3 && (
                <span className="badge-next badge-next-emerald">🎁 15% Bundle Discount Active!</span>
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
                      background: qty > 0 ? 'rgba(249, 115, 22, 0.05)' : 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <h4 style={{ fontSize: '0.96rem', color: '#ffffff' }}>{item.name}</h4>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--orange-primary)' }}>₹{item.price}</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginBottom: 12 }}>
                      {maxStock} in stock
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quantity:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => updateEquipQty(item.id, -1, maxStock)}
                          disabled={qty === 0}
                          className="btn-next btn-next-sm btn-next-secondary"
                          style={{ padding: '4px 8px', borderRadius: 6 }}
                        >
                          <Minus size={13} />
                        </button>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', minWidth: 20, textAlign: 'center', color: '#ffffff' }}>
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateEquipQty(item.id, 1, maxStock)}
                          disabled={qty >= maxStock}
                          className="btn-next btn-next-sm btn-next-secondary"
                          style={{ padding: '4px 8px', borderRadius: 6 }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column: Sticky Authoritative Match Estimate */}
        <div className="receipt-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', color: '#ffffff' }}>Match Estimate</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Authoritative server-side calculation
              </p>
            </div>
            <span className={`badge-next ${calculatingPrice ? 'badge-next-dim live-pulse' : 'badge-next-orange'}`}>
              {calculatingPrice ? 'Calculating...' : 'Live Pricing'}
            </span>
          </div>

          {/* Session Overview Box */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Court:</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{selectedCourt?.name || 'Select a Court'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Date:</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{date}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Starting Slot:</span>
              <span style={{ color: selectedSlot ? 'var(--orange-primary)' : 'var(--text-dim)', fontWeight: 700 }}>
                {selectedSlot ? `${selectedSlot} IST (${duration} hr${duration > 1 ? 's' : ''})` : 'Not Selected'}
              </span>
            </div>
            {selectedCoach && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                <span style={{ color: 'var(--text-dim)' }}>Coach:</span>
                <span style={{ color: '#c084fc', fontWeight: 600 }}>{selectedCoach.name}</span>
              </div>
            )}
          </div>

          {/* Itemized Line Items */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '12px 0', marginBottom: 16 }}>
            {priceCalc?.breakdown && priceCalc.breakdown.length > 0 ? (
              priceCalc.breakdown.map((item, idx) => {
                const val = typeof item.amount === 'number' ? item.amount : (typeof item.value === 'number' ? item.value : 0);
                const isDiscount = val < 0;

                return (
                  <div key={idx} className={`receipt-line ${isDiscount ? 'receipt-discount' : ''}`}>
                    <span>{item.label}</span>
                    <span style={{ fontWeight: 600 }}>
                      {isDiscount ? `-₹${Math.abs(val)}` : `₹${val}`}
                    </span>
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '6px 0' }}>
                Calculating authoritative breakdown...
              </div>
            )}
          </div>

          {/* Active Applied Rules Tags */}
          {priceCalc?.applied_rules && priceCalc.applied_rules.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 700 }}>
                Discounts & Multipliers Applied
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {priceCalc.applied_rules.map((rule, idx) => (
                  <span key={idx} className="badge-next badge-next-emerald" style={{ fontSize: '0.7rem' }}>
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Total Price Display */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
            <div>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-muted)' }}>Total Amount</span>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Includes GST & Facility Access</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
                ₹{priceCalc ? (priceCalc.total_price ?? priceCalc.totalPrice ?? 0) : 0}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {user ? (
            <button
              type="button"
              onClick={handleReserve}
              disabled={submitting || !selectedSlot || !selectedCourtId}
              className="btn-next btn-next-primary btn-next-lg"
              style={{ width: '100%', height: 48 }}
            >
              {submitting ? (
                <span>⚡ Row-Locking & Reserving...</span>
              ) : (
                <>
                  <Zap size={18} />
                  <span>Confirm & Reserve Court</span>
                </>
              )}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={handleQuickDemoReserve}
                disabled={submitting || !selectedSlot || !selectedCourtId}
                className="btn-next btn-next-primary btn-next-lg"
                style={{ width: '100%', height: 48 }}
              >
                {submitting ? (
                  <span>⚡ Reserving with Demo Player...</span>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>⚡ Quick Book as Demo Player</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={triggerAuth}
                className="btn-next btn-next-secondary btn-next-lg"
                style={{ width: '100%', height: 44, fontSize: '0.9rem' }}
              >
                Sign In to Reserve
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, fontSize: '0.74rem', color: 'var(--text-dim)' }}>
            <Shield size={13} color="#10b981" />
            <span>Concurrency-safe • Row-level database protection</span>
          </div>
        </div>
      </div>
    </div>
  );
};
