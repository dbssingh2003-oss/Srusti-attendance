import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import confetti from 'canvas-confetti';
import { 
  GraduationCap, 
  Database, 
  Lock, 
  Mail, 
  User as UserIcon, 
  ArrowRight, 
  Sparkles, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle,
  Hash,
  Shield,
  BookOpen
} from 'lucide-react';
import { Role } from '../types';

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';

export const LoginView: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('LOGIN');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<Role>('STUDENT');
  const [regRollNo, setRegRollNo] = useState('');

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);

  // Status / Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetMessages = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();
    try {
      await register({
        name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        rollNo: regRole === 'STUDENT' ? regRollNo : undefined,
      });

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();
    try {
      const res = await apiRequest<{ message: string; devToken?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });

      setSuccessMsg(res.message);
      if (res.devToken) {
        setResetToken(res.devToken);
      }
      setForgotStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();
    try {
      const res = await apiRequest<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword }),
      });

      setSuccessMsg(res.message || 'Password reset successful! Please sign in.');
      setTimeout(() => {
        setMode('LOGIN');
        setEmail(forgotEmail);
        setPassword(newPassword);
        setForgotStep(1);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please verify the reset token.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickDemo = (demoEmail: string) => {
    setMode('LOGIN');
    setEmail(demoEmail);
    setPassword('Password123');
    resetMessages();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '2rem 1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background ambient radial glows */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none',
      }} />

      {/* Main Container Card */}
      <div className="glass-panel animate-slide-up" style={{
        width: '100%',
        maxWidth: mode === 'REGISTER' ? '500px' : '440px',
        padding: '2.5rem 2rem',
        position: 'relative',
        zIndex: 10,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.18)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        transition: 'max-width 0.3s ease',
      }}>
        {/* Brand Crest */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.5)',
            marginBottom: '0.85rem',
          }}>
            <GraduationCap size={32} color="#ffffff" />
          </div>

          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Srusti Attendance
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '3px' }}>
            Smart Real-Time College Attendance Engine
          </p>
        </div>

        {/* Database connectivity badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '5px 12px',
          borderRadius: '999px',
          background: 'rgba(6, 182, 212, 0.1)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          marginBottom: '1.5rem',
          fontSize: '0.75rem',
          color: '#38bdf8',
          fontWeight: 600,
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4' }} className="animate-live-dot" />
          <Database size={13} />
          <span>Connected to Neon Cloud DB</span>
        </div>

        {/* Mode Selector Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.75rem',
        }}>
          <button
            type="button"
            onClick={() => { setMode('LOGIN'); resetMessages(); }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: mode === 'LOGIN' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
              color: mode === 'LOGIN' ? '#ffffff' : 'var(--text-dim)',
              boxShadow: mode === 'LOGIN' ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('REGISTER'); resetMessages(); }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: mode === 'REGISTER' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
              color: mode === 'REGISTER' ? '#ffffff' : 'var(--text-dim)',
              boxShadow: mode === 'REGISTER' ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            Register / Join
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }} className="animate-fade-in">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Success notification */}
        {successMsg && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }} className="animate-fade-in">
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ===================== 1. SIGN IN FORM ===================== */}
        {mode === 'LOGIN' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }} className="animate-fade-in">
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                College Email
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  placeholder="you@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '38px' }}
                />
                <Mail size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setMode('FORGOT_PASSWORD'); resetMessages(); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#818cf8',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Forgot Password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '38px' }}
                />
                <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ===================== 2. REGISTER / JOIN FORM ===================== */}
        {mode === 'REGISTER' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade-in">
            {/* Role Segmented Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Join As
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {(['STUDENT', 'TEACHER', 'ADMIN'] as Role[]).map((r) => {
                  const isSelected = regRole === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRegRole(r)}
                      style={{
                        padding: '10px 4px',
                        borderRadius: '10px',
                        border: isSelected ? '1px solid #6366f1' : '1px solid var(--border-subtle)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                        color: isSelected ? '#ffffff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {r === 'STUDENT' && <GraduationCap size={16} color={isSelected ? '#38bdf8' : 'currentColor'} />}
                      {r === 'TEACHER' && <BookOpen size={16} color={isSelected ? '#818cf8' : 'currentColor'} />}
                      {r === 'ADMIN' && <Shield size={16} color={isSelected ? '#f87171' : 'currentColor'} />}
                      <span>{r === 'STUDENT' ? 'Student' : r === 'TEACHER' ? 'Teacher' : 'Admin'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aditi Rao"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '38px' }}
                />
                <UserIcon size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                College Email
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  placeholder="name@college.edu"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '38px' }}
                />
                <Mail size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
              </div>
            </div>

            {regRole === 'STUDENT' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Student Roll Number
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 21CS065"
                    value={regRollNo}
                    onChange={(e) => setRegRollNo(e.target.value.toUpperCase())}
                    className="input-field"
                    style={{ paddingLeft: '38px', textTransform: 'uppercase' }}
                  />
                  <Hash size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Password (min 6 chars)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Create a strong password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '38px' }}
                />
                <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {loading ? (
                <span>Creating Account in Neon DB...</span>
              ) : (
                <>
                  <span>Complete Registration</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ===================== 3. FORGOT PASSWORD FLOW ===================== */}
        {mode === 'FORGOT_PASSWORD' && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <KeyRound size={20} color="#818cf8" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Reset Account Password</h2>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestReset} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Enter your registered college email address to generate a secure password reset token.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Registered Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      required
                      placeholder="you@college.edu"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="input-field"
                      style={{ paddingLeft: '38px' }}
                    />
                    <Mail size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                >
                  {loading ? 'Generating Token...' : 'Generate Reset Token'}
                </button>

                <button
                  type="button"
                  onClick={() => { setMode('LOGIN'); resetMessages(); }}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%' }}
                >
                  Back to Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  A reset token was generated. Enter your token and desired new password below.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Reset Token
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Paste reset token here"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="input-field"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    New Password (min 10 chars, 1 uppercase, 1 lowercase, 1 number)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter new strong password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                >
                  {loading ? 'Updating Password...' : 'Save New Password'}
                </button>

                <button
                  type="button"
                  onClick={() => setForgotStep(1)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%' }}
                >
                  Re-enter Email
                </button>
              </form>
            )}
          </div>
        )}

        {/* ONE-CLICK DEMO ACCOUNTS (ALWAYS VISIBLE FOR EFFORTLESS TESTING) */}
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
            <Sparkles size={13} color="#818cf8" />
            <span>Instant Role Demos (One-Click)</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => fillQuickDemo('admin@college.edu')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '6px 4px' }}
            >
              👑 Admin
            </button>
            <button
              type="button"
              onClick={() => fillQuickDemo('rajesh.kumar@college.edu')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '6px 4px' }}
            >
              👨‍🏫 Teacher
            </button>
            <button
              type="button"
              onClick={() => fillQuickDemo('21cs001@college.edu')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '6px 4px' }}
            >
              🎓 Student
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '8px' }}>
            Seed password for all test accounts is <code>Password123</code>
          </p>
        </div>
      </div>
    </div>
  );
};
