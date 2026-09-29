import React, { createContext, useContext, useState, useEffect } from 'react';
import { Participant, AdminUser } from '../types';
import { api } from '../services/apiClient';

interface AuthContextType {
  participant: Participant | null;
  admin: AdminUser | null;
  isLoading: boolean;
  loginParticipant: (identifier: string, pass: string) => Promise<void>;
  registerParticipant: (data: { fullName: string; vtuNumber: string; email: string; password: string }) => Promise<void>;
  logoutParticipant: () => void;
  loginAdmin: (email: string, pass: string) => Promise<void>;
  logoutAdmin: () => void;
  refreshParticipant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from existing tokens without destroying concurrent sessions
  useEffect(() => {
    const initAuth = async () => {
      // 1. Restore Admin session if admin token is present
      const adminToken = localStorage.getItem('cm_r2_token_admin') || sessionStorage.getItem('cm_r2_token_admin');
      if (adminToken) {
        try {
          const a = await api.getAdminMe();
          setAdmin({
            id: a.id || a.sub,
            email: a.email,
            fullName: a.full_name || 'Administrator',
            role: a.role || 'admin',
          });
        } catch {
          // Token expired or invalid
          api.clearToken('admin');
          setAdmin(null);
        }
      }

      // 2. Restore Participant session
      const participantToken = localStorage.getItem('cm_r2_token_participant') || sessionStorage.getItem('cm_r2_token_participant');
      const cachedProfile = localStorage.getItem('cm_r2_participant_profile');
      let loadedFromCache = false;

      if (cachedProfile) {
        try {
          const cp = JSON.parse(cachedProfile);
          setParticipant(cp);
          loadedFromCache = true;
        } catch {
          // ignore
        }
      }

      if (participantToken || api.getParticipantId()) {
        try {
          const p = await api.getParticipantMe();
          const pData: Participant = {
            id: p.id,
            fullName: p.full_name,
            vtuNumber: p.vtu_number,
            email: p.email,
            status: p.status,
            isDisqualified: Boolean(p.is_disqualified),
            disqualificationReason: p.disqualification_reason,
            warningsCount: p.warnings_count,
            round2Score: p.round2_score,
            extraTimeMinutes: p.extra_time_minutes ?? p.extraTimeMinutes ?? 0,
            submittedAt: p.submitted_at,
            lastActive: p.last_active,
            createdAt: p.created_at,
            activeSubmission: p.active_submission,
          };
          setParticipant(pData);
          api.setParticipantInfo(p.id, p.vtu_number);
          localStorage.setItem('cm_r2_participant_profile', JSON.stringify(pData));
        } catch {
          if (!loadedFromCache) {
            setParticipant(null);
          }
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  const loginParticipant = async (identifier: string, pass: string) => {
    const res = await api.participantLogin(identifier, pass);
    api.setToken('participant', res.access_token);
    const p = res.user;
    const pData: Participant = {
      id: p.id,
      fullName: p.full_name,
      vtuNumber: p.vtu_number,
      email: p.email,
      status: p.status,
      isDisqualified: Boolean(p.is_disqualified),
      disqualificationReason: p.disqualification_reason,
      warningsCount: p.warnings_count,
      round2Score: p.round2_score,
      extraTimeMinutes: p.extra_time_minutes ?? p.extraTimeMinutes ?? 0,
      submittedAt: p.submitted_at,
      lastActive: p.last_active,
      createdAt: p.created_at,
    };
    api.setParticipantInfo(p.id, p.vtu_number);
    localStorage.setItem('cm_r2_participant_profile', JSON.stringify(pData));
    setParticipant(pData);
  };

  const registerParticipant = async (data: { fullName: string; vtuNumber: string; email: string; password: string }) => {
    const res = await api.participantRegister(data);
    api.setToken('participant', res.access_token);
    const p = res.user;
    const pData: Participant = {
      id: p.id,
      fullName: p.full_name,
      vtuNumber: p.vtu_number,
      email: p.email,
      status: p.status,
      isDisqualified: Boolean(p.is_disqualified),
      disqualificationReason: p.disqualification_reason,
      warningsCount: p.warnings_count,
      round2Score: p.round2_score,
      extraTimeMinutes: p.extra_time_minutes ?? p.extraTimeMinutes ?? 0,
      submittedAt: p.submitted_at,
      lastActive: p.last_active,
      createdAt: p.created_at,
    };
    api.setParticipantInfo(p.id, p.vtu_number);
    localStorage.setItem('cm_r2_participant_profile', JSON.stringify(pData));
    setParticipant(pData);
  };

  const logoutParticipant = () => {
    api.clearToken('participant');
    localStorage.removeItem('cm_r2_participant_profile');
    setParticipant(null);
  };

  const loginAdmin = async (email: string, pass: string) => {
    // Completely clear participant session
    api.clearToken('participant');
    setParticipant(null);

    const res = await api.adminLogin(email, pass);
    api.setToken('admin', res.access_token);
    const a = res.user;
    setAdmin({
      id: a.id || a.sub,
      email: a.email,
      fullName: a.full_name || 'Administrator',
      role: a.role || 'admin',
    });
  };

  const logoutAdmin = () => {
    api.clearToken('admin');
    setAdmin(null);
  };

  const refreshParticipant = async () => {
    try {
      const p = await api.getParticipantMe();
      const pData: Participant = {
        id: p.id,
        fullName: p.full_name,
        vtuNumber: p.vtu_number,
        email: p.email,
        status: p.status,
        isDisqualified: Boolean(p.is_disqualified),
        disqualificationReason: p.disqualification_reason,
        warningsCount: p.warnings_count,
        round2Score: p.round2_score,
        extraTimeMinutes: p.extra_time_minutes ?? p.extraTimeMinutes ?? 0,
        submittedAt: p.submitted_at,
        lastActive: p.last_active,
        createdAt: p.created_at,
        activeSubmission: p.active_submission,
      };
      setParticipant(pData);
      api.setParticipantInfo(p.id, p.vtu_number);
      localStorage.setItem('cm_r2_participant_profile', JSON.stringify(pData));
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        participant,
        admin,
        isLoading,
        loginParticipant,
        registerParticipant,
        logoutParticipant,
        loginAdmin,
        logoutAdmin,
        refreshParticipant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
