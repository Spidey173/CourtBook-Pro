import React, { useState, useEffect } from 'react';
import { User } from './types';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { CourtReservationHub } from './components/CourtReservationHub';
import { MatchHistory } from './components/MatchHistory';
import { AdminConsole } from './components/AdminConsole';
import { Toast, ToastMessage } from './components/Toast';
import { Trophy, ShieldCheck, Github, Zap } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'book' | 'history' | 'admin'>('book');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [initializing, setInitializing] = useState<boolean>(true);

  // Global toast dispenser
  const showToast = (type: ToastMessage['type'], message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Bootstrap session check
  const checkSession = async () => {
    try {
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
      setUser(null);
      setActiveTab('book');
      showToast('info', 'You have been signed out.');
    } catch (err: any) {
      showToast('error', err.message || 'Logout failed.');
    }
  };

  const handleQuickDemoLogin = async (role: 'admin' | 'player') => {
    try {
      const loggedUser = await api.demoLogin(role === 'admin' ? 'admin' : 'user');
      setUser(loggedUser);
      showToast('success', `Signed in as Demo ${role === 'admin' ? 'Admin' : 'Player'}.`);
      if (role === 'admin') {
        setActiveTab('admin');
      } else {
        setActiveTab('book');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Quick demo login failed.');
    }
  };

  const handleBookingCreated = () => {
    showToast('success', 'Championship Court reservation successfully confirmed!');
    // Switch to history tab to view confirmed slot
    setActiveTab('history');
  };

  const handleTabSelect = (tab: 'book' | 'history' | 'admin') => {
    if ((tab === 'history' || tab === 'admin') && !user) {
      setShowAuthModal(true);
      return;
    }
    if (tab === 'admin' && !(user?.is_admin || user?.isAdmin)) {
      showToast('warning', 'Admin privileges required to access the operations console.');
      return;
    }
    setActiveTab(tab);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)' }}>
      {/* Toast Notification Container */}
      <Toast toasts={toasts} onClose={removeToast} />

      {/* Navigation Header */}
      <Navbar
        user={user}
        activeTab={activeTab}
        onSelectTab={handleTabSelect}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onQuickDemoLogin={handleQuickDemoLogin}
      />

      {/* Main App Content */}
      <main style={{ flex: 1 }}>
        {activeTab === 'book' && (
          <CourtReservationHub
            user={user}
            onAuthRequired={() => setShowAuthModal(true)}
            onBookingCreated={handleBookingCreated}
            showToast={showToast}
          />
        )}

        {activeTab === 'history' && (
          <MatchHistory
            onBookNew={() => setActiveTab('book')}
            showToast={showToast}
          />
        )}

        {activeTab === 'admin' && (
          <AdminConsole showToast={showToast} />
        )}
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setShowAuthModal(false);
            showToast('success', `Welcome back, ${loggedInUser.username}!`);
          }}
        />
      )}

      {/* Modern Next.js-Caliber Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(9, 9, 11, 0.95)',
          padding: '36px 24px',
          marginTop: 'auto',
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
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
              }}
            >
              <Trophy size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                CourtBook Pro
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Decoupled React 19 + TypeScript frontend with Neon PostgreSQL concurrency engine
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} style={{ color: 'var(--emerald-primary)' }} />
              <span>Row-Level Locked (FOR UPDATE)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} style={{ color: 'var(--orange-primary)' }} />
              <span>UTC Offsets Strict</span>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            © {new Date().getFullYear()} CourtBook Pro. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
export default App;

