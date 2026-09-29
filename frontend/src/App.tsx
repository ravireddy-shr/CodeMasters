import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/common/Navbar';
import { ParticipantLoginPage } from './pages/participant/ParticipantLoginPage';
import { ParticipantDashboardPage } from './pages/participant/ParticipantDashboardPage';
import { Round2CodingPage } from './pages/participant/Round2CodingPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminQuestionsPage } from './pages/admin/AdminQuestionsPage';
import { AdminSubmissionsPage } from './pages/admin/AdminSubmissionsPage';
import { AdminParticipantsPage } from './pages/admin/AdminParticipantsPage';
import { AdminLeaderboardPage } from './pages/admin/AdminLeaderboardPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

const AppContent: React.FC = () => {
  const { participant, admin, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.hash.replace('#', '') || '/participant/login';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') || '/';
      setCurrentPath(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
    setCurrentPath(path);
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          gap: '14px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '3px solid rgba(0, 245, 160, 0.2)',
            borderTopColor: '#00f5a0',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span>Initializing Code Masters Round 2 Platform...</span>
      </div>
    );
  }

  // Routing Logic
  const renderRoute = () => {
    switch (currentPath) {
      case '/':
      case '/participant/login':
        return participant ? <ParticipantDashboardPage onNavigate={navigate} /> : <ParticipantLoginPage onNavigate={navigate} />;

      case '/participant/dashboard':
        return participant ? <ParticipantDashboardPage onNavigate={navigate} /> : <ParticipantLoginPage onNavigate={navigate} />;

      case '/participant/coding':
        return participant ? <Round2CodingPage onNavigate={navigate} /> : <ParticipantLoginPage onNavigate={navigate} />;

      case '/admin':
      case '/admin/login':
        return admin ? <AdminDashboardPage onNavigate={navigate} /> : <AdminLoginPage onNavigate={navigate} />;

      case '/admin/dashboard':
        return admin ? <AdminDashboardPage onNavigate={navigate} /> : <AdminLoginPage onNavigate={navigate} />;

      case '/admin/questions':
        return admin ? <AdminQuestionsPage onNavigate={navigate} /> : <AdminLoginPage onNavigate={navigate} />;

      case '/admin/submissions':
        return admin ? <AdminSubmissionsPage onNavigate={navigate} /> : <AdminLoginPage onNavigate={navigate} />;

      case '/admin/participants':
        return admin ? <AdminParticipantsPage onNavigate={navigate} /> : <AdminLoginPage onNavigate={navigate} />;

      case '/admin/leaderboard':
        return admin ? <AdminLeaderboardPage onNavigate={navigate} /> : <AdminLoginPage onNavigate={navigate} />;

      case '/admin/settings':
        return admin ? <AdminSettingsPage onNavigate={navigate} /> : <AdminLoginPage onNavigate={navigate} />;

      default:
        if (currentPath.startsWith('/admin')) {
          return admin ? <AdminDashboardPage onNavigate={navigate} /> : <AdminLoginPage onNavigate={navigate} />;
        }
        return participant ? <ParticipantDashboardPage onNavigate={navigate} /> : <ParticipantLoginPage onNavigate={navigate} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar currentPath={currentPath} onNavigate={navigate} />
      <div style={{ flex: 1 }}>{renderRoute()}</div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
