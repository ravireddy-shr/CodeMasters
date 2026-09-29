/**
 * API Client for Code Masters Round 2 Platform
 * Handles authentication headers, token persistence, and backend endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

class ApiClient {
  private getToken(type: 'participant' | 'admin' = 'participant'): string | null {
    return localStorage.getItem(`cm_r2_token_${type}`) || sessionStorage.getItem(`cm_r2_token_${type}`);
  }

  setToken(type: 'participant' | 'admin', token: string) {
    localStorage.setItem(`cm_r2_token_${type}`, token);
    sessionStorage.setItem(`cm_r2_token_${type}`, token);
  }

  clearToken(type: 'participant' | 'admin') {
    localStorage.removeItem(`cm_r2_token_${type}`);
    sessionStorage.removeItem(`cm_r2_token_${type}`);
    if (type === 'participant') {
      localStorage.removeItem('cm_r2_participant_id');
      localStorage.removeItem('cm_r2_participant_vtu');
      sessionStorage.removeItem('cm_r2_participant_id');
      sessionStorage.removeItem('cm_r2_participant_vtu');
    }
  }

  setParticipantInfo(id: string, vtu: string) {
    if (id) {
      localStorage.setItem('cm_r2_participant_id', id);
      sessionStorage.setItem('cm_r2_participant_id', id);
    }
    if (vtu) {
      localStorage.setItem('cm_r2_participant_vtu', vtu);
      sessionStorage.setItem('cm_r2_participant_vtu', vtu);
    }
  }

  getParticipantId(): string | null {
    return localStorage.getItem('cm_r2_participant_id') || sessionStorage.getItem('cm_r2_participant_id');
  }

  getParticipantVTU(): string | null {
    return localStorage.getItem('cm_r2_participant_vtu') || sessionStorage.getItem('cm_r2_participant_vtu');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, authType: 'participant' | 'admin' = 'participant'): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken(authType);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (authType === 'participant') {
      const pId = this.getParticipantId();
      const pVtu = this.getParticipantVTU();
      if (pId) headers['X-Participant-Id'] = pId;
      if (pVtu) headers['X-Participant-VTU'] = pVtu;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.detail || data?.message || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data as T;
  }

  // ---------------------------------------------------------------------------
  // AUTH
  // ---------------------------------------------------------------------------
  async participantRegister(payload: { fullName: string; vtuNumber: string; email: string; password: string }) {
    return this.request<{ access_token: string; user: any }>('/auth/participant/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: payload.fullName,
        vtu_number: payload.vtuNumber,
        email: payload.email,
        password: payload.password,
      }),
    });
  }

  async participantLogin(identifier: string, password: string) {
    return this.request<{ access_token: string; user: any }>('/auth/participant/login', {
      method: 'POST',
      body: JSON.stringify({ email_or_vtu: identifier, password }),
    });
  }

  async getParticipantMe() {
    return this.request<any>('/auth/participant/me', {}, 'participant');
  }

  async adminLogin(email: string, password: string) {
    return this.request<{ access_token: string; user: any }>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getAdminMe() {
    return this.request<any>('/auth/admin/me', {}, 'admin');
  }

  // ---------------------------------------------------------------------------
  // PARTICIPANT CODING & SUBMISSIONS
  // ---------------------------------------------------------------------------
  async getAllQuestions() {
    return this.request<any[]>('/questions', {}, 'participant');
  }

  async getActiveQuestion() {
    return this.request<any>('/questions/active', {}, 'participant');
  }

  async runCode(questionId: string, code: string, language: string = 'python') {
    return this.request<any>('/code/run', {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, code, language }),
    }, 'participant');
  }

  async submitCode(questionId: string, code: string, isAutoSubmit: boolean = false, language: string = 'python') {
    return this.request<any>('/submissions/submit', {
      method: 'POST',
      body: JSON.stringify({
        question_id: questionId,
        code,
        is_auto_submit: isAutoSubmit,
        language,
      }),
    }, 'participant');
  }

  async getMyProgress() {
    return this.request<any>('/submissions/progress', {}, 'participant');
  }

  async finishContest() {
    return this.request<any>('/submissions/finish-contest', {
      method: 'POST',
    }, 'participant');
  }

  async reportWarning(reason: string, message: string) {
    return this.request<any>('/warnings', {
      method: 'POST',
      body: JSON.stringify({ reason, message }),
    }, 'participant');
  }

  async getSettings() {
    return this.request<any>('/settings', {}, 'participant');
  }

  // ---------------------------------------------------------------------------
  // ADMIN DASHBOARD & MANAGEMENT
  // ---------------------------------------------------------------------------
  async getAdminStats() {
    return this.request<any>('/admin/stats', {}, 'admin');
  }

  async adminListQuestions() {
    return this.request<any[]>('/admin/questions', {}, 'admin');
  }

  async adminSeedRound2Suite() {
    return this.request<any>('/admin/questions/seed-round2-suite', {
      method: 'POST',
    }, 'admin');
  }

  async adminCreateQuestion(payload: any) {
    return this.request<any>('/admin/questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 'admin');
  }

  async adminUpdateQuestion(questionId: string, payload: any) {
    return this.request<any>(`/admin/questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, 'admin');
  }

  async adminDeleteQuestion(questionId: string) {
    return this.request<any>(`/admin/questions/${questionId}`, {
      method: 'DELETE',
    }, 'admin');
  }

  async adminToggleQuestionActive(questionId: string) {
    return this.request<any>(`/admin/questions/${questionId}/toggle-active`, {
      method: 'POST',
    }, 'admin');
  }

  async adminListSubmissions() {
    return this.request<any[]>('/admin/submissions', {}, 'admin');
  }

  async adminListParticipants() {
    return this.request<any[]>('/admin/participants', {}, 'admin');
  }

  async adminOverrideParticipant(participantId: string, action: string, reason?: string) {
    return this.request<any>(`/admin/participants/${participantId}/override`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    }, 'admin');
  }

  async adminGetLeaderboard() {
    return this.request<any[]>('/admin/leaderboard', {}, 'admin');
  }

  async adminUpdateSettings(settingsData: any) {
    return this.request<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settingsData),
    }, 'admin');
  }

  async adminAdjustTime(deltaMinutes: number) {
    return this.request<any>('/settings/adjust-time', {
      method: 'POST',
      body: JSON.stringify({ delta_minutes: deltaMinutes }),
    }, 'admin');
  }

  async adminAddParticipantExtraTime(participantId: string, extraMinutes: number, reason?: string) {
    return this.request<any>(`/admin/participants/${participantId}/extra-time`, {
      method: 'POST',
      body: JSON.stringify({ extra_minutes: extraMinutes, reason }),
    }, 'admin');
  }

  async adminBulkAddExtraTime(extraMinutes: number, reason?: string) {
    return this.request<any>('/admin/participants/bulk/extra-time', {
      method: 'POST',
      body: JSON.stringify({ extra_minutes: extraMinutes, reason }),
    }, 'admin');
  }
}

export const api = new ApiClient();

