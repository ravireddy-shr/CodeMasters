import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Terminal, Shield, LogOut, LayoutDashboard, Code2, Trophy } from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const { participant, admin, logoutParticipant, logoutAdmin } = useAuth();

  return (
    <header
      style={{
        height: 'var(--nav-height)',
        background: 'rgba(7, 11, 20, 0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 'var(--max-width)',
          height: '100%',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand / Logo */}
        <div
          onClick={() => {
            if (currentPath.startsWith('/admin')) {
              onNavigate(admin ? '/admin/dashboard' : '/admin/login');
            } else {
              onNavigate(participant ? '/participant/dashboard' : '/participant/login');
            }
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #00f5a0 0%, #00d9f5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#070b14',
              boxShadow: '0 0 15px rgba(0, 245, 160, 0.3)',
            }}
          >
            <Terminal size={22} strokeWidth={2.5} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.04em', color: '#fff' }}>
                CODEMASTERS
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(0, 245, 160, 0.15)',
                  border: '1px solid rgba(0, 245, 160, 0.3)',
                  color: '#00f5a0',
                }}
              >
                ROUND 2
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Vel Tech Coding Club • CSE(AIML)
            </div>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Participant Nav Links - Strictly for participants */}
          {participant && !currentPath.startsWith('/admin') && (
            <>
              <button
                onClick={() => onNavigate('/participant/dashboard')}
                className={`btn btn-sm ${currentPath === '/participant/dashboard' ? 'btn-secondary' : 'btn-outline'}`}
                style={{ borderColor: currentPath === '/participant/dashboard' ? '#00d9f5' : 'transparent' }}
              >
                <LayoutDashboard size={14} />
                Dashboard
              </button>

              <button
                onClick={() => onNavigate('/participant/coding')}
                className={`btn btn-sm ${currentPath === '/participant/coding' ? 'btn-secondary' : 'btn-outline'}`}
                style={{ borderColor: currentPath === '/participant/coding' ? '#00f5a0' : 'transparent' }}
              >
                <Code2 size={14} />
                Python IDE
              </button>
            </>
          )}

          {/* Admin Nav Links - Strictly for admin on admin routes */}
          {admin && currentPath.startsWith('/admin') && (
            <>
              <button
                onClick={() => onNavigate('/admin/dashboard')}
                className={`btn btn-sm ${currentPath === '/admin/dashboard' ? 'btn-secondary' : 'btn-outline'}`}
              >
                <Shield size={14} />
                Admin Dashboard
              </button>
              <button
                onClick={() => onNavigate('/admin/leaderboard')}
                className={`btn btn-sm ${currentPath === '/admin/leaderboard' ? 'btn-secondary' : 'btn-outline'}`}
              >
                <Trophy size={14} />
                Leaderboard
              </button>
            </>
          )}
        </nav>

        {/* User Auth Chip & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {participant && !currentPath.startsWith('/admin') ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#00f5a0', fontWeight: 700 }}>
                  {participant.vtuNumber}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Score: <strong style={{ color: '#fff' }}>{participant.round2Score ?? 0}</strong>
                </span>
              </div>

              <button
                onClick={() => {
                  logoutParticipant();
                  onNavigate('/participant/login');
                }}
                className="btn btn-outline btn-sm"
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : admin && currentPath.startsWith('/admin') ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: '#93c5fd',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ADMIN: {admin.email}
              </span>
              <button
                onClick={() => {
                  logoutAdmin();
                  onNavigate('/admin/login');
                }}
                className="btn btn-outline btn-sm"
                title="Logout Admin"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              {currentPath.startsWith('/admin') ? (
                <button onClick={() => onNavigate('/participant/login')} className="btn btn-outline btn-sm">
                  Student Portal
                </button>
              ) : (
                <button onClick={() => onNavigate('/participant/login')} className="btn btn-primary btn-sm">
                  Participant Login
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
