import React from 'react';
import { User } from '../types';
import { Trophy, Calendar, Clock, Shield, LogOut, User as UserIcon, Sparkles } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  activeTab: 'book' | 'history' | 'admin';
  onSelectTab: (tab: 'book' | 'history' | 'admin') => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onQuickDemoLogin: (role: 'admin' | 'player') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  onSelectTab,
  onOpenAuth,
  onLogout,
  onQuickDemoLogin,
}) => {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(9, 9, 11, 0.82)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '12px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {/* Brand Identity */}
        <div
          onClick={() => onSelectTab('book')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(249, 115, 22, 0.4)',
              color: '#ffffff',
            }}
          >
            <Trophy size={22} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', color: '#ffffff' }}>
              COURTBOOK <span style={{ color: 'var(--orange-primary)' }}>PRO</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Championship Arena System
            </div>
          </div>
        </div>

        {/* Center Navigation Tabs (when logged in) */}
        {user && (
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 4,
              gap: 4,
            }}
          >
            <button
              onClick={() => onSelectTab('book')}
              className={`btn-next btn-next-sm ${activeTab === 'book' ? 'btn-next-primary' : 'btn-next-secondary'}`}
              style={{ border: 'none' }}
            >
              <Calendar size={15} />
              <span>Court Reservation</span>
            </button>
            <button
              onClick={() => onSelectTab('history')}
              className={`btn-next btn-next-sm ${activeTab === 'history' ? 'btn-next-primary' : 'btn-next-secondary'}`}
              style={{ border: 'none' }}
            >
              <Clock size={15} />
              <span>My Matches</span>
            </button>
            {user.is_admin && (
              <button
                onClick={() => onSelectTab('admin')}
                className={`btn-next btn-next-sm ${activeTab === 'admin' ? 'btn-next-primary' : 'btn-next-secondary'}`}
                style={{ border: 'none' }}
              >
                <Shield size={15} />
                <span>Operations Console</span>
              </button>
            )}
          </nav>
        )}

        {/* Right Action / Auth Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '6px 12px',
                }}
              >
                <span className={`badge-next ${user.is_admin ? 'badge-next-orange' : 'badge-next-emerald'}`}>
                  {user.is_admin ? 'Admin' : 'Player'}
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.username}
                </span>
              </div>

              <button
                onClick={onLogout}
                className="btn-next btn-next-danger btn-next-sm"
                title="Sign out of arena session"
              >
                <LogOut size={15} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Quick Demo Login Pill for Reviewers */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => onQuickDemoLogin('player')}
                  className="btn-next btn-next-sm btn-next-secondary"
                  style={{ fontSize: '0.78rem', background: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgba(249, 115, 22, 0.3)' }}
                >
                  <Sparkles size={13} color="var(--orange-primary)" />
                  <span>Demo Player</span>
                </button>
                <button
                  onClick={() => onQuickDemoLogin('admin')}
                  className="btn-next btn-next-sm btn-next-secondary"
                  style={{ fontSize: '0.78rem', background: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.3)' }}
                >
                  <Shield size={13} color="#c084fc" />
                  <span>Demo Admin</span>
                </button>
              </div>

              <button onClick={onOpenAuth} className="btn-next btn-next-primary btn-next-sm">
                <UserIcon size={15} />
                <span>Sign In</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

