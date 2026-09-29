import React from 'react';
import {
  LayoutDashboard,
  Code2,
  FileCheck,
  Users,
  Trophy,
  Sliders,
  LogOut,
  Terminal,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AdminSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ currentPath, onNavigate }) => {
  const { logoutAdmin, admin } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'Questions & Tests', path: '/admin/questions', icon: <Code2 size={18} /> },
    { label: 'Submissions', path: '/admin/submissions', icon: <FileCheck size={18} /> },
    { label: 'Participants', path: '/admin/participants', icon: <Users size={18} /> },
    { label: 'Leaderboard', path: '/admin/leaderboard', icon: <Trophy size={18} /> },
    { label: 'Settings & Timers', path: '/admin/settings', icon: <Sliders size={18} /> },
  ];

  return (
    <aside
      style={{
        width: '260px',
        background: '#090e1c',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - var(--nav-height))',
      }}
    >
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <Terminal size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>Admin Command</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Round 2 Platform</div>
          </div>
        </div>
      </div>

      <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: isActive ? 'rgba(0, 217, 245, 0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(0, 217, 245, 0.3)' : '1px solid transparent',
                color: isActive ? '#00d9f5' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'var(--transition)',
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Info & Logout */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Logged in as: <strong style={{ color: '#fff' }}>{admin?.email}</strong>
        </div>
        <button
          onClick={() => {
            logoutAdmin();
            onNavigate('/admin/login');
          }}
          className="btn btn-outline btn-sm"
          style={{ width: '100%', justifyContent: 'flex-start', color: '#ef4444' }}
        >
          <LogOut size={14} />
          Logout Admin
        </button>
      </div>
    </aside>
  );
};
