import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Terminal, Lock, User, Mail, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';

interface ParticipantLoginPageProps {
  onNavigate: (path: string) => void;
}

export const ParticipantLoginPage: React.FC<ParticipantLoginPageProps> = ({ onNavigate }) => {
  const { loginParticipant, registerParticipant } = useAuth();
  const [isRegister, setIsRegister] = useState(false);

  // Form fields
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [vtuNumber, setVtuNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isRegister) {
        if (!fullName.trim() || !vtuNumber.trim() || !email.trim() || !password) {
          throw new Error('Please fill in all registration fields');
        }
        await registerParticipant({
          fullName: fullName.trim(),
          vtuNumber: vtuNumber.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
          password,
        });
      } else {
        if (!identifier.trim() || !password) {
          throw new Error('Please enter your VTU Number or Email and Password');
        }
        await loginParticipant(identifier.trim(), password);
      }
      onNavigate('/participant/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - var(--nav-height) - 40px)',
        padding: '30px 20px',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '36px 32px',
          border: '1px solid rgba(0, 245, 160, 0.25)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #00f5a0 0%, #00d9f5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#070b14',
              margin: '0 auto 16px',
              boxShadow: '0 0 20px rgba(0, 245, 160, 0.3)',
            }}
          >
            <Terminal size={28} strokeWidth={2.5} />
          </div>

          <h2 style={{ fontSize: '1.65rem', marginBottom: '6px', color: '#fff' }}>
            {isRegister ? 'Participant Registration' : 'Participant Login'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            {isRegister
              ? 'Register your official student profile for Round 2'
              : 'Enter your credentials to access the Python Debugging Arena'}
          </p>
        </div>

        {error && (
          <div className="form-error" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister ? (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="e.g. Ravi Kishore Reddy"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">VTU Roll Number</label>
                <div style={{ position: 'relative' }}>
                  <Terminal size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '38px', textTransform: 'uppercase' }}
                    placeholder="e.g. VTU29263"
                    value={vtuNumber}
                    onChange={(e) => setVtuNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">VTU Student Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="vtu29263@veltech.edu.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label className="form-label">VTU Number or Email</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                  placeholder="VTU29263 or student email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '10px' }}
          >
            {isLoading ? 'Authenticating...' : (isRegister ? 'Complete Registration' : 'Enter Contest Arena')}
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '22px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {isRegister ? (
            <>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => setIsRegister(false)}
                style={{ background: 'transparent', border: 'none', color: '#00f5a0', fontWeight: 600, cursor: 'pointer' }}
              >
                Login here
              </button>
            </>
          ) : (
            <>
              New to Code Masters Round 2?{' '}
              <button
                type="button"
                onClick={() => setIsRegister(true)}
                style={{ background: 'transparent', border: 'none', color: '#00f5a0', fontWeight: 600, cursor: 'pointer' }}
              >
                Register profile
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => onNavigate('/admin/login')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Admin or Faculty Proctor?</span>
            <span style={{ color: '#93c5fd', textDecoration: 'underline' }}>Admin Portal Login &rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
};
