import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  GraduationCap, 
  Database, 
  LogOut, 
  User as UserIcon, 
  ShieldCheck, 
  Sparkles,
  Layers
} from 'lucide-react';

interface NavbarProps {
  onSwitchUser?: (email: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onSwitchUser }) => {
  const { user, logout } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return { label: 'Admin', color: 'rgba(239, 68, 68, 0.2)', text: '#f87171', border: 'rgba(239, 68, 68, 0.4)' };
      case 'TEACHER':
        return { label: 'Faculty', color: 'rgba(99, 102, 241, 0.2)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.4)' };
      default:
        return { label: 'Student', color: 'rgba(16, 185, 129, 0.2)', text: '#34d399', border: 'rgba(16, 185, 129, 0.4)' };
    }
  };

  const badge = getRoleBadge(user?.role);

  return (
    <header style={{
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      background: 'rgba(9, 13, 22, 0.85)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0.75rem 1.5rem',
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.45)',
          }}>
            <GraduationCap size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, #cbd5e1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                SRUSTI
              </span>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '999px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', fontWeight: 700 }}>
                PORTAL
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Real-Time Academic Attendance Engine
            </p>
          </div>
        </div>

        {/* Right Info & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Neon DB Status Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            borderRadius: '999px',
            fontSize: '0.75rem',
            color: '#38bdf8',
            fontWeight: 600,
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#06b6d4',
              boxShadow: '0 0 8px #06b6d4',
            }} className="animate-live-dot" />
            <Database size={13} />
            <span>Neon DB Connected</span>
          </div>

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* Quick Switcher dropdown pills */}
              {onSwitchUser && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginRight: '2px' }}>
                    Quick Login:
                  </span>
                  <button 
                    onClick={() => onSwitchUser('admin@college.edu')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                    title="Switch to Admin"
                  >
                    Admin
                  </button>
                  <button 
                    onClick={() => onSwitchUser('rajesh.kumar@college.edu')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                    title="Switch to Teacher"
                  >
                    Teacher
                  </button>
                  <button 
                    onClick={() => onSwitchUser('21cs001@college.edu')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                    title="Switch to Student"
                  >
                    Student
                  </button>
                </div>
              )}

              {/* User Pill */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 14px',
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                }}>
                  <UserIcon size={16} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {user.rollNo ? `Roll: ${user.rollNo}` : user.email}
                  </div>
                </div>

                <span style={{
                  padding: '3px 8px',
                  background: badge.color,
                  color: badge.text,
                  border: `1px solid ${badge.border}`,
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  {badge.label}
                </span>
              </div>

              {/* Logout Button */}
              <button 
                onClick={logout}
                className="btn btn-secondary btn-sm"
                style={{ padding: '8px 12px', color: '#f87171' }}
                title="Sign out"
              >
                <LogOut size={16} />
                <span>Exit</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
