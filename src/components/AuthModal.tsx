import React, { useState } from 'react';
import { X, Lock, User as UserIcon, Mail, Sparkles, Shield, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';
import { useToast } from './Toast';

interface AuthModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen = true, onClose, onSuccess }) => {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  if (isOpen === false) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === 'login') {
        const user = await api.login(username, password);
        showToast('success', 'Welcome Back!', `Signed in as ${user.username}`);
        onSuccess(user);
        onClose();
      } else {
        const user = await api.signup(username, email, password);
        showToast('success', 'Account Created!', `Welcome to CourtBook Pro, ${user.username}`);
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
      showToast('error', 'Authentication Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillQuickDemo = (role: 'admin' | 'player') => {
    setError(null);
    if (role === 'admin') {
      setUsername('admin');
      setPassword('Admin@123456');
    } else {
      setUsername('demo_user');
      setPassword('Demo@123456');
    }
    setTab('login');
  };

  return (
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
      onClick={onClose}
    >
      <div
        className="next-card"
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#141418',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
          padding: 32,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header & Close */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', color: '#ffffff' }}>
              {tab === 'login' ? 'Sign In to Arena' : 'Create Player Account'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {tab === 'login' ? 'Access multi-resource court reservations' : 'Join championship court matchmaking'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 1-Click Quick Demo Sandbox Credentials */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color="var(--orange-primary)" />
            <span>1-CLICK DEMO EVALUATION SANDBOX</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => fillQuickDemo('player')}
              className="btn-next btn-next-sm btn-next-secondary"
              style={{ fontSize: '0.78rem', justifyContent: 'flex-start', padding: '8px 10px' }}
            >
              <span>🏸</span>
              <span style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, color: '#ffffff' }}>Demo Player</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>demo_user</div>
              </span>
            </button>
            <button
              type="button"
              onClick={() => fillQuickDemo('admin')}
              className="btn-next btn-next-sm btn-next-secondary"
              style={{ fontSize: '0.78rem', justifyContent: 'flex-start', padding: '8px 10px' }}
            >
              <Shield size={14} color="#c084fc" />
              <span style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, color: '#ffffff' }}>Demo Admin</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>admin</div>
              </span>
            </button>
          </div>
        </div>

        {/* Tab Toggle */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 10,
            padding: 4,
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); }}
            style={{
              flex: 1,
              padding: '8px 0',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '0.88rem',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: tab === 'login' ? 'var(--orange-primary)' : 'transparent',
              color: tab === 'login' ? '#ffffff' : 'var(--text-dim)',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setError(null); }}
            style={{
              flex: 1,
              padding: '8px 0',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '0.88rem',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: tab === 'signup' ? 'var(--orange-primary)' : 'transparent',
              color: tab === 'signup' ? '#ffffff' : 'var(--text-dim)',
              transition: 'all 0.15s ease',
            }}
          >
            Join Arena
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#f87171',
              fontSize: '0.84rem',
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Username {tab === 'login' && 'or Email'}
            </label>
            <div style={{ position: 'relative' }}>
              <UserIcon size={16} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input
                type="text"
                required
                className="next-input"
                style={{ paddingLeft: 38 }}
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          {tab === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="email"
                  required
                  className="next-input"
                  style={{ paddingLeft: 38 }}
                  placeholder="player@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input
                type="password"
                required
                className="next-input"
                style={{ paddingLeft: 38 }}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-next btn-next-primary btn-next-lg"
            style={{ marginTop: 8 }}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{tab === 'login' ? 'Sign In Now' : 'Create Arena Account'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

