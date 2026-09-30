import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { getSocket } from '../lib/socket';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  BookOpen,
  Calendar,
  Sparkles,
  ChevronRight,
  TrendingUp,
  QrCode,
  ShieldAlert,
  History
} from 'lucide-react';

interface SummaryData {
  stats: Array<{
    subject: { id: string; code: string; name: string };
    present: number;
    total: number;
    pct: number;
  }>;
  overall: {
    present: number;
    total: number;
    pct: number;
  };
}

interface TodayClass {
  id: string;
  classCode: string;
  startsAt: string;
  endsAt: string;
  windowOpensAt: string;
  windowClosesAt: string;
  status: string;
  subject: { id: string; code: string; name: string };
  attendanceStatus?: string | null;
}

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSubjectHistory, setSelectedSubjectHistory] = useState<any[] | null>(null);
  const [historySubjectName, setHistorySubjectName] = useState<string>('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Load Dashboard Data
  const loadData = async () => {
    try {
      const [sumData, todayData] = await Promise.all([
        apiRequest<SummaryData>('/attendance/summary'),
        apiRequest<TodayClass[]>('/attendance/today'),
      ]);
      setSummary(sumData);
      setTodayClasses(todayData);
    } catch (err: any) {
      console.error('Failed to load student data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Socket.IO Real-Time listeners
    const socket = getSocket();
    if (socket) {
      socket.on('dashboard:updated', () => {
        loadData();
      });
      socket.on('session:opened', (data: { subjectName: string }) => {
        loadData();
        setMessage({
          type: 'success',
          text: `🔔 Check-in window opened for ${data.subjectName}! Enter your code now.`,
        });
      });
    }

    return () => {
      if (socket) {
        socket.off('dashboard:updated');
        socket.off('session:opened');
      }
    };
  }, []);

  // Handle 6-character Code Input
  const handleDigitChange = (index: number, val: string) => {
    const cleaned = val.toUpperCase().replace(/[^A-HJ-KM-NP-Z2-9]/g, '');
    const newDigits = [...digits];

    if (cleaned.length > 1) {
      // Pasting full or partial code
      const chars = cleaned.split('').slice(0, 6);
      for (let i = 0; i < 6; i++) {
        newDigits[i] = chars[i] || '';
      }
      setDigits(newDigits);
      const nextIdx = Math.min(chars.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    newDigits[index] = cleaned;
    setDigits(newDigits);

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const submitCheckin = async (codeOverride?: string) => {
    const code = codeOverride || digits.join('');
    if (code.length < 6) {
      setMessage({ type: 'error', text: 'Please enter the complete 6-character class code.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await apiRequest<{ message: string; markedAt: string }>('/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({
          code,
          deviceId: navigator.userAgent.substring(0, 32),
        }),
      });

      // Confetti celebration on success!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#38bdf8', '#fbbf24'],
      });

      setMessage({
        type: 'success',
        text: `🎉 Attendance successfully recorded at ${new Date(res.markedAt).toLocaleTimeString()}!`,
      });
      setDigits(['', '', '', '', '', '']);
      loadData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Check-in failed. Please check the code and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const viewHistory = async (subjectId: string, subjectName: string) => {
    try {
      const history = await apiRequest<any[]>(`/attendance/history/${subjectId}`);
      setSelectedSubjectHistory(history);
      setHistorySubjectName(subjectName);
    } catch (err: any) {
      console.error(err);
    }
  };

  const isLowAttendance = summary && summary.overall.pct < 50 && summary.overall.total > 0;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Alert Banner if Low Attendance */}
      {isLowAttendance && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem 1.5rem',
          borderRadius: 'var(--radius-lg)',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
        }} className="animate-slide-up">
          <ShieldAlert size={28} color="#ef4444" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f87171' }}>
              ATTENDANCE WARNING (Below 50% Threshold)
            </div>
            <div style={{ fontSize: '0.85rem', color: '#fecaca' }}>
              Your overall attendance is currently <strong>{summary?.overall.pct}%</strong>. College regulations require a minimum of 50% attendance to be eligible for end-term examinations.
            </div>
          </div>
        </div>
      )}

      {/* Main Top Grid: Check-in Box & Overall Metric */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.5rem',
      }}>
        
        {/* CHECK-IN CARD */}
        <div className="glass-panel" style={{
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Ambient Glow */}
          <div style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.25)',
            filter: 'blur(50px)',
            pointerEvents: 'none',
          }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <QrCode size={22} color="#818cf8" />
                <span style={{ fontWeight: 800, fontSize: '1.15rem' }}>Fast Check-In</span>
              </div>
              <span className="badge badge-open">
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} className="animate-live-dot" />
                Live Active
              </span>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
              Enter the 6-character code announced by your instructor to mark your presence.
            </p>

            {/* 6-Digit Code Input */}
            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'center',
              marginBottom: '1.5rem',
            }}>
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="digit-box"
                  placeholder="•"
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            {/* Notification message */}
            {message && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: message.type === 'success' ? '#34d399' : '#f87171',
                border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }} className="animate-fade-in">
                {message.text}
              </div>
            )}
          </div>

          <button
            onClick={() => submitCheckin()}
            disabled={submitting || digits.join('').length < 6}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {submitting ? (
              <span>Validating Code...</span>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>Mark Attendance Now</span>
              </>
            )}
          </button>
        </div>

        {/* OVERALL ATTENDANCE SUMMARY CARD */}
        <div className="glass-panel" style={{
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={22} color="#06b6d4" />
                <span style={{ fontWeight: 800, fontSize: '1.15rem' }}>Attendance Performance</span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                Term 2026-27
              </span>
            </div>

            {/* Big Circular or Dial Metric */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2rem',
              padding: '1.25rem 0',
            }}>
              <div style={{
                position: 'relative',
                width: '110px',
                height: '110px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `conic-gradient(${isLowAttendance ? '#ef4444' : '#10b981'} ${summary ? summary.overall.pct * 3.6 : 0}deg, rgba(255, 255, 255, 0.08) 0deg)`,
                boxShadow: '0 0 25px rgba(0, 0, 0, 0.5)',
              }}>
                <div style={{
                  width: '88px',
                  height: '88px',
                  borderRadius: '50%',
                  background: 'var(--bg-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>
                    {summary ? `${summary.overall.pct}%` : '0%'}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Overall
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Classes Attended</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>
                    {summary?.overall.present ?? 0} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>/ {summary?.overall.total ?? 0}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Minimum Required</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f59e0b' }}>
                    50.0% Minimum
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            padding: '10px 14px',
            background: 'rgba(30, 41, 59, 0.4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Sparkles size={16} color="#818cf8" />
            <span>Attendance is synchronized in real time with faculty class logs.</span>
          </div>
        </div>
      </div>

      {/* TODAY'S CLASSES & CHECK-IN SESSIONS */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Calendar size={20} color="#818cf8" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Today's Classes & Sessions</h2>
        </div>

        {todayClasses.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No scheduled class sessions found for today. Enjoy your day!
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem',
          }}>
            {todayClasses.map((item) => {
              const isOpen = item.status === 'OPEN';
              const isMarked = item.attendanceStatus === 'PRESENT';

              return (
                <div key={item.id} className="glass-panel glass-panel-interactive" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase' }}>
                        {item.subject.code}
                      </span>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                        {item.subject.name}
                      </h3>
                    </div>
                    {isMarked ? (
                      <span className="badge badge-present">Checked In</span>
                    ) : isOpen ? (
                      <span className="badge badge-open">Window Open</span>
                    ) : (
                      <span className="badge badge-scheduled">{item.status}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    <Clock size={14} />
                    <span>
                      {new Date(item.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(item.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {isOpen && !isMarked && (
                    <button
                      onClick={() => submitCheckin(item.classCode)}
                      className="btn btn-success btn-sm"
                      style={{ width: '100%' }}
                    >
                      Quick Check-In ({item.classCode})
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ENROLLED SUBJECTS BREAKDOWN */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <BookOpen size={20} color="#38bdf8" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Enrolled Subjects & Attendance</h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '1.25rem',
        }}>
          {summary?.stats.map((s) => {
            const isLow = s.pct < 50 && s.total > 0;
            return (
              <div key={s.subject.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.04em' }}>
                        {s.subject.code}
                      </span>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                        {s.subject.name}
                      </h4>
                    </div>
                    <span style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: isLow ? '#ef4444' : s.pct >= 75 ? '#10b981' : '#f59e0b',
                    }}>
                      {s.pct}%
                    </span>
                  </div>

                  {/* Progress track */}
                  <div className="progress-track" style={{ margin: '1rem 0' }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(s.pct, 100)}%`,
                        background: isLow
                          ? 'linear-gradient(90deg, #ef4444, #f87171)'
                          : s.pct >= 75
                          ? 'linear-gradient(90deg, #10b981, #34d399)'
                          : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Attended: <strong>{s.present}</strong> of {s.total}</span>
                    {isLow && (
                      <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <AlertTriangle size={14} /> Below 50%
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => viewHistory(s.subject.id, s.subject.name)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', marginTop: '1.25rem' }}
                >
                  <History size={14} />
                  <span>View Attendance History</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* History Modal */}
      {selectedSubjectHistory && (
        <div className="modal-backdrop" onClick={() => setSelectedSubjectHistory(null)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Attendance History</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{historySubjectName}</p>
              </div>
              <button onClick={() => setSelectedSubjectHistory(null)} className="btn btn-secondary btn-sm">Close</button>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedSubjectHistory.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No past records found.</p>
              ) : (
                selectedSubjectHistory.map((rec, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'rgba(30, 41, 59, 0.4)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {new Date(rec.session.startsAt).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {new Date(rec.session.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className={`badge badge-${rec.status.toLowerCase()}`}>
                      {rec.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
