import React, { useState, useEffect } from 'react';
import { Court, Coach, Equipment, AdminStats, Booking } from '../types';
import { api } from '../services/api';
import {
  ShieldAlert,
  DollarSign,
  CalendarCheck,
  Activity,
  Users,
  Layers,
  Wrench,
  Award,
  TrendingUp,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Save,
  Check,
  AlertCircle,
  Filter,
} from 'lucide-react';

interface AdminConsoleProps {
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ showToast }) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'courts' | 'equipment' | 'coaches' | 'pricing' | 'bookings'
  >('overview');
  const [loading, setLoading] = useState<boolean>(true);

  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Modal / Form states
  const [showAddCourtModal, setShowAddCourtModal] = useState(false);
  const [newCourt, setNewCourt] = useState({ name: '', type: 'indoor', basePrice: 20, isActive: true });

  const [showAddEquipModal, setShowAddEquipModal] = useState(false);
  const [newEquip, setNewEquip] = useState({ name: '', price: 5, totalAvailable: 10, isActive: true });

  const [showAddCoachModal, setShowAddCoachModal] = useState(false);
  const [newCoach, setNewCoach] = useState({ name: '', price: 15, specialization: 'General Training', isActive: true });

  const [savingRules, setSavingRules] = useState(false);

  // Load admin data
  const loadAllData = async () => {
    try {
      setLoading(true);
      const [statsRes, courtsRes, equipRes, coachesRes, pricingRes, bookingsRes] = await Promise.all([
        api.getAdminStats().catch(() => null),
        api.getAdminCourts().catch(() => []),
        api.getAdminEquipment().catch(() => []),
        api.getAdminCoaches().catch(() => []),
        api.getAdminPricingRules().catch(() => ({ data: [] })),
        api.getAdminBookings().catch(() => []),
      ]);

      if (statsRes) setStats(statsRes);
      setCourts(courtsRes);
      setEquipment(equipRes);
      setCoaches(coachesRes);
      setPricingRules(pricingRes?.data || pricingRes?.rules || (Array.isArray(pricingRes) ? pricingRes : []));
      setBookings(bookingsRes);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load admin telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Court Actions
  const handleCreateCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourt.name.trim()) return;
    try {
      const created = await api.createAdminCourt(newCourt);
      setCourts((prev) => [...prev, created]);
      setShowAddCourtModal(false);
      setNewCourt({ name: '', type: 'indoor', basePrice: 20, isActive: true });
      showToast('success', `Court "${newCourt.name}" registered successfully.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to add court.');
    }
  };

  const handleToggleCourtActive = async (court: Court) => {
    const currentActive = court.is_active ?? court.isActive ?? true;
    const newActive = !currentActive;
    try {
      await api.updateAdminCourt(court.id, { is_active: newActive, isActive: newActive });
      setCourts((prev) =>
        prev.map((c) => (c.id === court.id ? { ...c, is_active: newActive, isActive: newActive } : c))
      );
      showToast('success', `Court #${court.id} status updated.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update court status.');
    }
  };

  const handleDeleteCourt = async (courtId: number) => {
    if (!window.confirm(`Are you sure you want to delete Court #${courtId}?`)) return;
    try {
      await api.deleteAdminCourt(courtId);
      setCourts((prev) => prev.filter((c) => c.id !== courtId));
      showToast('success', `Court #${courtId} removed.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete court.');
    }
  };

  // Equipment Actions
  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquip.name.trim()) return;
    try {
      const created = await api.createAdminEquipment(newEquip);
      setEquipment((prev) => [...prev, created]);
      setShowAddEquipModal(false);
      setNewEquip({ name: '', price: 5, totalAvailable: 10, isActive: true });
      showToast('success', `Equipment "${newEquip.name}" added to inventory.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to add equipment.');
    }
  };

  const handleToggleEquipmentActive = async (item: Equipment) => {
    const currentActive = item.is_active ?? item.isActive ?? true;
    const newActive = !currentActive;
    try {
      await api.updateAdminEquipment(item.id, { is_active: newActive, isActive: newActive });
      setEquipment((prev) =>
        prev.map((e) => (e.id === item.id ? { ...e, is_active: newActive, isActive: newActive } : e))
      );
      showToast('success', `${item.name} status updated.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update equipment status.');
    }
  };

  const handleDeleteEquipment = async (id: number) => {
    if (!window.confirm(`Delete equipment item #${id}?`)) return;
    try {
      await api.deleteAdminEquipment(id);
      setEquipment((prev) => prev.filter((e) => e.id !== id));
      showToast('success', 'Equipment item removed.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete equipment.');
    }
  };

  // Coach Actions
  const handleCreateCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoach.name.trim()) return;
    try {
      const created = await api.createAdminCoach(newCoach);
      setCoaches((prev) => [...prev, created]);
      setShowAddCoachModal(false);
      setNewCoach({ name: '', price: 15, specialization: 'General Training', isActive: true });
      showToast('success', `Coach "${newCoach.name}" added to roster.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to add coach.');
    }
  };

  const handleToggleCoachActive = async (coach: Coach) => {
    const currentActive = coach.is_active ?? coach.isActive ?? true;
    const newActive = !currentActive;
    try {
      await api.updateAdminCoach(coach.id, { is_active: newActive, isActive: newActive });
      setCoaches((prev) =>
        prev.map((c) => (c.id === coach.id ? { ...c, is_active: newActive, isActive: newActive } : c))
      );
      showToast('success', `Coach ${coach.name} status updated.`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update coach status.');
    }
  };

  const handleDeleteCoach = async (id: number) => {
    if (!window.confirm(`Delete coach #${id}?`)) return;
    try {
      await api.deleteAdminCoach(id);
      setCoaches((prev) => prev.filter((c) => c.id !== id));
      showToast('success', 'Coach removed from roster.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete coach.');
    }
  };

  // Pricing Rules Actions
  const handleSavePricingRules = async () => {
    try {
      setSavingRules(true);
      await api.updateAdminPricingRules(pricingRules);
      showToast('success', 'Dynamic pricing matrix updated and published.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update pricing rules.');
    } finally {
      setSavingRules(false);
    }
  };

  const updateRuleField = (index: number, field: string, value: any) => {
    setPricingRules((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 20px 80px' }}>
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
              <ShieldAlert size={12} />
              Operations Command
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Arena Management & Telemetry
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
            CourtBook Pro Admin Console
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0' }}>
            Full control over court availability, coach rosters, equipment stock, dynamic pricing algorithms, and real-time ledger.
          </p>
        </div>

        <button
          onClick={loadAllData}
          disabled={loading}
          className="btn-next btn-next-secondary"
          title="Refresh All Telemetry"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* KPI Stats Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 20,
          marginBottom: 32,
        }}
      >
        {/* Revenue */}
        <div className="card-next">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Gross Arena Revenue
            </span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--emerald-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>
            ${(stats?.totalRevenue ?? 0).toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--emerald-primary)', marginTop: 6 }}>
            Live PostgreSQL aggregated transactions
          </div>
        </div>

        {/* Bookings */}
        <div className="card-next">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Reservations
            </span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(249, 115, 22, 0.12)',
                color: 'var(--orange-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarCheck size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>
            {stats?.totalBookings ?? bookings.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Across all indoor & outdoor surfaces
          </div>
        </div>

        {/* Courts */}
        <div className="card-next">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Active Courts
            </span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>
            {courts.filter((c) => (c.is_active ?? c.isActive ?? true)).length} / {courts.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: 6 }}>
            Tournament grade availability
          </div>
        </div>

        {/* Registered Users */}
        <div className="card-next">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Registered Players
            </span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(168, 85, 247, 0.12)',
                color: '#c084fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>
            {stats?.totalUsers ?? '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Active club members & guests
          </div>
        </div>
      </div>

      {/* Admin Subtabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflowX: 'auto',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 12,
          marginBottom: 28,
        }}
      >
        {[
          { key: 'overview', label: 'Overview & Velocity', icon: Activity },
          { key: 'courts', label: `Courts (${courts.length})`, icon: Layers },
          { key: 'equipment', label: `Equipment (${equipment.length})`, icon: Wrench },
          { key: 'coaches', label: `Coaches (${coaches.length})`, icon: Award },
          { key: 'pricing', label: 'Dynamic Pricing', icon: TrendingUp },
          { key: 'bookings', label: `Ledger (${bookings.length})`, icon: CalendarCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`btn-next btn-next-sm ${
                isActive ? 'btn-next-primary' : 'btn-next-secondary'
              }`}
              style={{
                borderRadius: 20,
                padding: '7px 16px',
                border: isActive ? 'none' : '1px solid var(--border-subtle)',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {/* 1. OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card-next">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>
              Real-Time Concurrency & Row-Locking Status
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
              CourtBook Pro runs exclusively on PostgreSQL with explicit <code>SELECT ... FOR UPDATE</code> row-level pessimistic locking and UTC timestamp offsets. Zero double-booking vulnerability under heavy simultaneous loads.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Storage Engine
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--orange-primary)', marginTop: 4 }}>
                  Neon Serverless PostgreSQL
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                  Pooler endpoint with SSL verify-full
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Locking Primitive
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--emerald-primary)', marginTop: 4 }}>
                  Row-Level FOR UPDATE
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                  Prevents race conditions in BookingSlot inserts
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Timezone Standard
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#60a5fa', marginTop: 4 }}>
                  ISO 8601 UTC Normalized
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                  No cross-midnight off-by-one errors
                </div>
              </div>
            </div>
          </div>

          {/* Recent Bookings in Overview */}
          <div className="card-next">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                Recent Bookings Stream
              </h3>
              <button
                onClick={() => setActiveTab('bookings')}
                className="btn-next btn-next-sm btn-next-secondary"
              >
                View All Ledger
              </button>
            </div>
            {bookings.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
                No bookings recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}>Ref</th>
                      <th style={{ padding: '10px 12px' }}>Player</th>
                      <th style={{ padding: '10px 12px' }}>Court</th>
                      <th style={{ padding: '10px 12px' }}>Date & Slot</th>
                      <th style={{ padding: '10px 12px' }}>Amount</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.slice(0, 5).map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 700 }}>
                          #CB-{b.id}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {b.user?.username || `User #${b.user_id}`}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {b.court?.name || `Court #${b.court_id}`}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {b.date} ({b.time_slot || b.timeSlot})
                        </td>
                        <td style={{ padding: '12px', fontWeight: 700 }}>
                          ${(b.total_price ?? b.totalPrice ?? 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            className={`badge-next ${
                              b.status === 'CONFIRMED'
                                ? 'badge-next-emerald'
                                : b.status === 'CANCELLED'
                                ? 'badge-next-rose'
                                : 'badge-next-blue'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. COURTS TAB */}
      {activeTab === 'courts' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Arena Courts</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                Manage championship tennis courts, surface types, and base hourly pricing.
              </p>
            </div>
            <button
              onClick={() => setShowAddCourtModal(true)}
              className="btn-next btn-next-primary"
            >
              <Plus size={16} />
              <span>Add New Court</span>
            </button>
          </div>

          <div className="card-next" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '14px 16px' }}>ID</th>
                    <th style={{ padding: '14px 16px' }}>Court Name</th>
                    <th style={{ padding: '14px 16px' }}>Surface Type</th>
                    <th style={{ padding: '14px 16px' }}>Base Price / Hour</th>
                    <th style={{ padding: '14px 16px' }}>Status</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courts.map((court) => {
                    const isActive = court.is_active ?? court.isActive ?? true;
                    return (
                      <tr key={court.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700 }}>
                          #{court.id}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {court.name}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className={`badge-next ${court.type === 'indoor' ? 'badge-next-blue' : 'badge-next-orange'}`}>
                            {court.type.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                          ${(court.base_price ?? court.basePrice ?? 20).toFixed(2)}/hr
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className={`badge-next ${isActive ? 'badge-next-emerald' : 'badge-next-rose'}`}>
                            {isActive ? 'ACTIVE' : 'OFFLINE'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button
                              onClick={() => handleToggleCourtActive(court)}
                              className="btn-next btn-next-sm btn-next-secondary"
                              title={isActive ? 'Deactivate Court' : 'Activate Court'}
                            >
                              {isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                              <span>{isActive ? 'Disable' : 'Enable'}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteCourt(court.id)}
                              className="btn-next btn-next-sm btn-next-secondary"
                              style={{ color: 'var(--rose-primary)', borderColor: 'rgba(244,63,94,0.3)' }}
                              title="Delete Court"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. EQUIPMENT TAB */}
      {activeTab === 'equipment' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Equipment Inventory</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                Rental racquets, balls, and ball machines with live stock tracking.
              </p>
            </div>
            <button
              onClick={() => setShowAddEquipModal(true)}
              className="btn-next btn-next-primary"
            >
              <Plus size={16} />
              <span>Add Equipment Item</span>
            </button>
          </div>

          <div className="card-next" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '14px 16px' }}>ID</th>
                    <th style={{ padding: '14px 16px' }}>Item Name</th>
                    <th style={{ padding: '14px 16px' }}>Rental Price</th>
                    <th style={{ padding: '14px 16px' }}>Total Stock</th>
                    <th style={{ padding: '14px 16px' }}>Status</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map((item) => {
                    const isActive = item.is_active ?? item.isActive ?? true;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700 }}>
                          #{item.id}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {item.name}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                          ${(item.price ?? 5).toFixed(2)}/item
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className="badge-next badge-next-blue">
                            {item.total_available ?? item.totalAvailable ?? 0} units
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className={`badge-next ${isActive ? 'badge-next-emerald' : 'badge-next-rose'}`}>
                            {isActive ? 'IN STOCK' : 'OFFLINE'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button
                              onClick={() => handleToggleEquipmentActive(item)}
                              className="btn-next btn-next-sm btn-next-secondary"
                            >
                              {isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                              <span>{isActive ? 'Disable' : 'Enable'}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteEquipment(item.id)}
                              className="btn-next btn-next-sm btn-next-secondary"
                              style={{ color: 'var(--rose-primary)', borderColor: 'rgba(244,63,94,0.3)' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. COACHES TAB */}
      {activeTab === 'coaches' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Coaching Roster</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                Certified professional trainers available for 1-on-1 private sessions.
              </p>
            </div>
            <button
              onClick={() => setShowAddCoachModal(true)}
              className="btn-next btn-next-primary"
            >
              <Plus size={16} />
              <span>Add Coach</span>
            </button>
          </div>

          <div className="card-next" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '14px 16px' }}>ID</th>
                    <th style={{ padding: '14px 16px' }}>Coach Name</th>
                    <th style={{ padding: '14px 16px' }}>Specialization</th>
                    <th style={{ padding: '14px 16px' }}>Hourly Fee</th>
                    <th style={{ padding: '14px 16px' }}>Status</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coaches.map((coach) => {
                    const isActive = coach.is_active ?? coach.isActive ?? true;
                    return (
                      <tr key={coach.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700 }}>
                          #{coach.id}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {coach.name}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className="badge-next badge-next-orange">
                            {coach.specialization}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                          ${(coach.price ?? 15).toFixed(2)}/hr
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className={`badge-next ${isActive ? 'badge-next-emerald' : 'badge-next-rose'}`}>
                            {isActive ? 'AVAILABLE' : 'OFFLINE'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button
                              onClick={() => handleToggleCoachActive(coach)}
                              className="btn-next btn-next-sm btn-next-secondary"
                            >
                              {isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                              <span>{isActive ? 'Disable' : 'Enable'}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteCoach(coach.id)}
                              className="btn-next btn-next-sm btn-next-secondary"
                              style={{ color: 'var(--rose-primary)', borderColor: 'rgba(244,63,94,0.3)' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. PRICING RULES TAB */}
      {activeTab === 'pricing' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Dynamic Pricing Engine</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                Adjust peak multipliers, weekend surcharges, and bundle discounts without redeploying code.
              </p>
            </div>
            <button
              onClick={handleSavePricingRules}
              disabled={savingRules}
              className="btn-next btn-next-primary"
            >
              <Save size={16} />
              <span>{savingRules ? 'Publishing...' : 'Save Pricing Matrix'}</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {pricingRules.map((rule, idx) => (
              <div key={idx} className="card-next">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span className="badge-next badge-next-orange">
                    {rule.rule_type?.replace(/_/g, ' ').toUpperCase() || `Rule #${idx + 1}`}
                  </span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => updateRuleField(idx, 'enabled', e.target.checked)}
                    />
                    <span>{rule.enabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {rule.multiplier !== undefined && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        Rate Multiplier (e.g. 1.25 = +25%)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={rule.multiplier}
                        onChange={(e) => updateRuleField(idx, 'multiplier', parseFloat(e.target.value) || 1.0)}
                        className="input-next"
                      />
                    </div>
                  )}

                  {rule.discount !== undefined && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        Discount Percentage (e.g. 0.15 = 15% off)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={rule.discount}
                        onChange={(e) => updateRuleField(idx, 'discount', parseFloat(e.target.value) || 0)}
                        className="input-next"
                      />
                    </div>
                  )}

                  {rule.start_time !== undefined && rule.end_time !== undefined && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                          Start Time
                        </label>
                        <input
                          type="text"
                          value={rule.start_time}
                          onChange={(e) => updateRuleField(idx, 'start_time', e.target.value)}
                          className="input-next"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                          End Time
                        </label>
                        <input
                          type="text"
                          value={rule.end_time}
                          onChange={(e) => updateRuleField(idx, 'end_time', e.target.value)}
                          className="input-next"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. ALL BOOKINGS LEDGER */}
      {activeTab === 'bookings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Full Booking Ledger</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
                Audit trail of all arena matches, court assignments, and cancellation status.
              </p>
            </div>
            <button
              onClick={loadAllData}
              className="btn-next btn-next-secondary btn-next-sm"
            >
              <RefreshCw size={14} />
              <span>Refresh Ledger</span>
            </button>
          </div>

          <div className="card-next" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '14px 16px' }}>Ref</th>
                    <th style={{ padding: '14px 16px' }}>Player</th>
                    <th style={{ padding: '14px 16px' }}>Court</th>
                    <th style={{ padding: '14px 16px' }}>Date & Slot</th>
                    <th style={{ padding: '14px 16px' }}>Coach</th>
                    <th style={{ padding: '14px 16px' }}>Amount</th>
                    <th style={{ padding: '14px 16px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700 }}>
                        #CB-{b.id}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {b.user?.username || `User #${b.user_id}`}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                        {b.court?.name || `Court #${b.court_id}`}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {b.date} ({b.time_slot || b.timeSlot})
                      </td>
                      <td style={{ padding: '14px 16px', color: b.coach ? 'var(--text-secondary)' : 'var(--text-dim)' }}>
                        {b.coach?.name || '—'}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                        ${(b.total_price ?? b.totalPrice ?? 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          className={`badge-next ${
                            b.status === 'CONFIRMED'
                              ? 'badge-next-emerald'
                              : b.status === 'CANCELLED'
                              ? 'badge-next-rose'
                              : 'badge-next-blue'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Court Modal */}
      {showAddCourtModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowAddCourtModal(false)}
        >
          <div
            className="card-next animate-in"
            style={{ maxWidth: 440, width: '100%', padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>
              Register Championship Court
            </h3>
            <form onSubmit={handleCreateCourt} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Court Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Center Court (Grass)"
                  value={newCourt.name}
                  onChange={(e) => setNewCourt({ ...newCourt, name: e.target.value })}
                  className="input-next"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Surface Type
                </label>
                <select
                  value={newCourt.type}
                  onChange={(e) => setNewCourt({ ...newCourt, type: e.target.value as any })}
                  className="input-next"
                >
                  <option value="indoor">Indoor (Hard Surface)</option>
                  <option value="outdoor">Outdoor (Clay / Grass)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Base Hourly Rate ($)
                </label>
                <input
                  type="number"
                  min="5"
                  step="1"
                  required
                  value={newCourt.basePrice}
                  onChange={(e) => setNewCourt({ ...newCourt, basePrice: parseFloat(e.target.value) || 20 })}
                  className="input-next"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddCourtModal(false)}
                  className="btn-next btn-next-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-next btn-next-primary">
                  Create Court
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Equipment Modal */}
      {showAddEquipModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowAddEquipModal(false)}
        >
          <div
            className="card-next animate-in"
            style={{ maxWidth: 440, width: '100%', padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>
              Add Equipment to Inventory
            </h3>
            <form onSubmit={handleCreateEquipment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pro Racket"
                  value={newEquip.name}
                  onChange={(e) => setNewEquip({ ...newEquip, name: e.target.value })}
                  className="input-next"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Rental Price ($)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={newEquip.price}
                  onChange={(e) => setNewEquip({ ...newEquip, price: parseFloat(e.target.value) || 5 })}
                  className="input-next"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Total Stock Available
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newEquip.totalAvailable}
                  onChange={(e) => setNewEquip({ ...newEquip, totalAvailable: parseInt(e.target.value, 10) || 10 })}
                  className="input-next"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddEquipModal(false)}
                  className="btn-next btn-next-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-next btn-next-primary">
                  Save Equipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Coach Modal */}
      {showAddCoachModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowAddCoachModal(false)}
        >
          <div
            className="card-next animate-in"
            style={{ maxWidth: 440, width: '100%', padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>
              Add Trainer to Roster
            </h3>
            <form onSubmit={handleCreateCoach} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Coach Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Roger Feder"
                  value={newCoach.name}
                  onChange={(e) => setNewCoach({ ...newCoach, name: e.target.value })}
                  className="input-next"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Specialization
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Serve & Volley Mastery"
                  value={newCoach.specialization}
                  onChange={(e) => setNewCoach({ ...newCoach, specialization: e.target.value })}
                  className="input-next"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Hourly Coaching Fee ($)
                </label>
                <input
                  type="number"
                  min="5"
                  step="1"
                  required
                  value={newCoach.price}
                  onChange={(e) => setNewCoach({ ...newCoach, price: parseFloat(e.target.value) || 15 })}
                  className="input-next"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddCoachModal(false)}
                  className="btn-next btn-next-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-next btn-next-primary">
                  Add Coach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

