import React, { useState, useEffect } from 'react';
import { Booking } from '../types';
import { api } from '../services/api';
import {
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  Package,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  PlusCircle,
  Receipt,
  Timer,
  ChevronRight,
} from 'lucide-react';

interface MatchHistoryProps {
  onBookNew: () => void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export const MatchHistory: React.FC<MatchHistoryProps> = ({ onBookNew, showToast }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [confirmModalId, setConfirmModalId] = useState<number | null>(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const data = await api.getUserBookings();
      // Sort newest first
      const sorted = [...data].sort((a, b) => b.id - a.id);
      setBookings(sorted);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load booking history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = async (bookingId: number) => {
    try {
      setCancellingId(bookingId);
      await api.cancelBooking(bookingId);
      // Optimistic update
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'CANCELLED' } : b))
      );
      setConfirmModalId(null);
      showToast('success', `Reservation #CB-${bookingId} was successfully cancelled.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to cancel reservation.');
    } finally {
      setCancellingId(null);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'ALL') return true;
    return b.status === filter;
  });

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="badge-next badge-next-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle2 size={13} />
            CONFIRMED
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="badge-next badge-next-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle2 size={13} />
            COMPLETED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="badge-next badge-next-rose" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <XCircle size={13} />
            CANCELLED
          </span>
        );
      default:
        return <span className="badge-next">{status}</span>;
    }
  };

  // Helper to format slot countdown or relative time
  const getTimeRemaining = (dateStr: string, timeSlot: string) => {
    try {
      const [startHourStr] = timeSlot.split(':');
      const startHour = parseInt(startHourStr, 10);
      const matchDate = new Date(`${dateStr}T${startHour.toString().padStart(2, '0')}:00:00`);
      const now = new Date();
      const diffMs = matchDate.getTime() - now.getTime();

      if (diffMs < 0) {
        return 'Session past';
      }
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);

      if (diffDays > 0) {
        return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
      }
      if (diffHrs > 0) {
        return `Starting in ~${diffHrs}h`;
      }
      return 'Starting soon';
    } catch {
      return '';
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px 80px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span className="badge-next badge-next-orange">
              <Receipt size={12} />
              Reservations Roster
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {bookings.length} Total Match{bookings.length === 1 ? '' : 'es'}
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
            Match & Court History
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0' }}>
            Track your confirmed court bookings, trainer assignments, and equipment rentals in real time.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={fetchBookings}
            disabled={loading}
            className="btn-next btn-next-secondary"
            title="Refresh bookings"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button onClick={onBookNew} className="btn-next btn-next-primary">
            <PlusCircle size={16} />
            <span>Reserve New Court</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 24,
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 12,
        }}
      >
        {(['ALL', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const).map((tab) => {
          const count =
            tab === 'ALL'
              ? bookings.length
              : bookings.filter((b) => b.status === tab).length;
          const isActive = filter === tab;
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`btn-next btn-next-sm ${
                isActive ? 'btn-next-primary' : 'btn-next-secondary'
              }`}
              style={{
                borderRadius: 20,
                padding: '6px 14px',
                border: isActive ? 'none' : '1px solid var(--border-subtle)',
              }}
            >
              <span>{tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isActive ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.08)',
                  marginLeft: 4,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content State */}
      {loading && bookings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--orange-primary)', margin: '0 auto 16px' }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading your reservations...</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            Syncing with PostgreSQL database
          </div>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div
          className="card-next"
          style={{
            textAlign: 'center',
            padding: '64px 24px',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: 'rgba(249, 115, 22, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--orange-primary)',
            }}
          >
            <Calendar size={28} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>
            {filter === 'ALL'
              ? 'No reservations recorded yet'
              : `No ${filter.toLowerCase()} reservations`}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 440, margin: '0 auto 24px' }}>
            {filter === 'ALL'
              ? 'Ready for a tournament-grade match? Select your court, choose an ATP coach, and book your slot in seconds.'
              : `You do not have any matches with status ${filter}.`}
          </p>
          <button onClick={onBookNew} className="btn-next btn-next-primary">
            <PlusCircle size={16} />
            <span>Book Your First Court</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {filteredBookings.map((b) => {
            const timeRemaining = getTimeRemaining(b.date, b.time_slot || b.timeSlot || '09:00');
            const courtName = b.court?.name || `Court #${b.court_id}`;
            const courtType = b.court?.type || 'indoor';
            const price = b.total_price ?? b.totalPrice ?? 0;
            const coachName = b.coach?.name;
            const duration = b.duration || 1;

            return (
              <div
                key={b.id}
                className="card-next"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border:
                    b.status === 'CONFIRMED'
                      ? '1px solid rgba(249, 115, 22, 0.3)'
                      : '1px solid var(--border-subtle)',
                  boxShadow:
                    b.status === 'CONFIRMED'
                      ? '0 8px 24px -10px rgba(249, 115, 22, 0.15)'
                      : 'none',
                }}
              >
                <div>
                  {/* Top Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 14,
                      paddingBottom: 12,
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: 'var(--text-secondary)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}
                      >
                        #CB-{b.id}
                      </span>
                      {b.status === 'CONFIRMED' && timeRemaining && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--orange-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontWeight: 600,
                          }}
                        >
                          <Timer size={12} />
                          {timeRemaining}
                        </span>
                      )}
                    </div>
                    {getStatusBadge(b.status)}
                  </div>

                  {/* Court Title & Type */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                        {courtName}
                      </h3>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginTop: 2,
                        }}
                      >
                        {courtType} Championship Surface
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: '1.35rem',
                        fontWeight: 800,
                        color: '#ffffff',
                        textAlign: 'right',
                      }}
                    >
                      ${price.toFixed(2)}
                    </div>
                  </div>

                  {/* Date & Time Slot Details */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                      <Calendar size={15} style={{ color: 'var(--orange-primary)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{b.date}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                      <Clock size={15} style={{ color: 'var(--orange-primary)', flexShrink: 0 }} />
                      <span>
                        <strong>{b.time_slot || b.timeSlot}</strong> ({duration} {duration === 1 ? 'hour' : 'hours'})
                      </span>
                    </div>
                    {b.start_time_utc && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginLeft: 23 }}>
                        UTC: {b.start_time_utc.replace('T', ' ')}
                      </div>
                    )}
                  </div>

                  {/* Coach & Equipment addons */}
                  {(coachName || (b.equipment_items && b.equipment_items.length > 0)) && (
                    <div
                      style={{
                        borderTop: '1px dashed var(--border-subtle)',
                        paddingTop: 10,
                        marginBottom: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {coachName && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <UserCheck size={14} style={{ color: 'var(--emerald-primary)' }} />
                          <span>Coach: <strong>{coachName}</strong> ({b.coach?.specialization || 'Certified Pro'})</span>
                        </div>
                      )}
                      {b.equipment_items && b.equipment_items.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <Package size={14} style={{ color: '#60a5fa' }} />
                          <span>
                            Equipment:{' '}
                            {b.equipment_items
                              .map(
                                (item) =>
                                  `${item.quantity}x ${item.equipment?.name || `Item #${item.equipment_id}`}`
                              )
                              .join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div
                  style={{
                    paddingTop: 14,
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Booked {new Date(b.created_at).toLocaleDateString()}
                  </span>

                  {b.status === 'CONFIRMED' && (
                    <button
                      onClick={() => setConfirmModalId(b.id)}
                      disabled={cancellingId === b.id}
                      className="btn-next btn-next-sm btn-next-secondary"
                      style={{
                        color: 'var(--rose-primary)',
                        borderColor: 'rgba(244, 63, 94, 0.3)',
                      }}
                    >
                      {cancellingId === b.id ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Cancelling...</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={13} />
                          <span>Cancel Slot</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setConfirmModalId(null)}
        >
          <div
            className="card-next animate-in"
            style={{
              maxWidth: 440,
              width: '100%',
              padding: 24,
              border: '1px solid rgba(244, 63, 94, 0.4)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  background: 'rgba(244, 63, 94, 0.15)',
                  color: 'var(--rose-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                  Cancel Reservation #CB-{confirmModalId}?
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  This will release your slot back to the arena.
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to cancel this booking? The slot will immediately become available for other players to reserve, and any coach / equipment reserved will be freed.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setConfirmModalId(null)}
                className="btn-next btn-next-secondary"
                disabled={cancellingId === confirmModalId}
              >
                Keep Booking
              </button>
              <button
                onClick={() => handleCancelBooking(confirmModalId)}
                className="btn-next btn-next-primary"
                style={{
                  background: 'var(--rose-primary)',
                  boxShadow: '0 4px 14px rgba(244, 63, 94, 0.4)',
                }}
                disabled={cancellingId === confirmModalId}
              >
                {cancellingId === confirmModalId ? 'Cancelling...' : 'Yes, Cancel Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

