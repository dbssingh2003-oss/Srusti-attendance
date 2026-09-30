import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { getSocket } from '../lib/socket';
import {
  Users,
  PlusCircle,
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  Lock,
  ChevronRight,
  Maximize2,
  Download,
  Calendar,
  Layers,
  Sparkles,
  StopCircle,
  Pencil,
  BookOpen,
  Check
} from 'lucide-react';
import { Subject, ClassSession, LiveSessionData } from '../types';

export const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<LiveSessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState({
    subjectId: '',
    startsAt: new Date().toISOString().slice(0, 16),
    endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    windowMinutes: 10,
  });
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Subject Manual Editing & Creation State
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectForm, setEditSubjectForm] = useState({ code: '', name: '' });
  const [showNewSubjectModal, setShowNewSubjectModal] = useState<boolean>(false);
  const [newSubjectForm, setNewSubjectForm] = useState({ code: '', name: '' });
  const [subjectActionLoading, setSubjectActionLoading] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Separate subjects into teacher's own and other department subjects
  const mySubjects = useMemo(
    () => subjects.filter((s: any) => s.isMine || s.teacherId === user?.id),
    [subjects, user]
  );
  const otherSubjects = useMemo(
    () => subjects.filter((s: any) => !s.isMine && s.teacherId !== user?.id),
    [subjects, user]
  );

  const openCreateSessionModal = () => {
    if (subjects.length > 0) {
      setCreateForm((prev) => ({
        ...prev,
        subjectId: prev.subjectId && subjects.some((s) => s.id === prev.subjectId)
          ? prev.subjectId
          : subjects[0].id,
      }));
    }
    setShowCreateModal(true);
  };

  const openEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setEditSubjectForm({ code: subject.code, name: subject.name });
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    setSubjectActionLoading(true);
    try {
      const updated = await apiRequest<Subject>(`/teacher/subjects/${editingSubject.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          code: editSubjectForm.code.trim().toUpperCase(),
          name: editSubjectForm.name.trim(),
        }),
      });

      // Reload fresh subjects from database
      const freshSubs = await apiRequest<Subject[]>('/teacher/subjects');
      setSubjects(freshSubs);
      setEditingSubject(null);
      setFeedbackMessage({
        type: 'success',
        text: `Subject updated successfully to "${updated.code} - ${updated.name}"!`,
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update subject');
    } finally {
      setSubjectActionLoading(false);
    }
  };

  const handleCreateNewSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubjectActionLoading(true);
    try {
      const created = await apiRequest<Subject>('/teacher/subjects', {
        method: 'POST',
        body: JSON.stringify({
          code: newSubjectForm.code.trim().toUpperCase(),
          name: newSubjectForm.name.trim(),
        }),
      });

      // Reload fresh subjects list directly from Neon database
      const freshSubs = await apiRequest<Subject[]>('/teacher/subjects');
      setSubjects(freshSubs);
      setCreateForm((prev) => ({ ...prev, subjectId: created.id }));
      setShowNewSubjectModal(false);
      setNewSubjectForm({ code: '', name: '' });
      setFeedbackMessage({
        type: 'success',
        text: `New subject "${created.code} - ${created.name}" created and assigned to you!`,
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to create subject');
    } finally {
      setSubjectActionLoading(false);
    }
  };

  // Load teacher subjects and recent sessions
  const loadTeacherData = async () => {
    try {
      const [subs, sess] = await Promise.all([
        apiRequest<Subject[]>('/teacher/subjects'),
        apiRequest<ClassSession[]>('/sessions'),
      ]);
      setSubjects(subs);
      setSessions(sess);

      if (subs.length > 0) {
        setCreateForm((prev) => ({
          ...prev,
          subjectId: prev.subjectId && subs.some((s) => s.id === prev.subjectId)
            ? prev.subjectId
            : subs[0].id,
        }));
      }
    } catch (err) {
      console.error('Failed to load teacher data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeacherData();
  }, []);

  // Keep createForm.subjectId aligned whenever subjects list changes
  useEffect(() => {
    if (subjects.length > 0) {
      setCreateForm((prev) => {
        if (!prev.subjectId || !subjects.some((s) => s.id === prev.subjectId)) {
          return { ...prev, subjectId: subjects[0].id };
        }
        return prev;
      });
    }
  }, [subjects]);

  // Poll / Listen to Live Session
  const loadLiveSession = async (sessionId: string) => {
    try {
      const data = await apiRequest<LiveSessionData>(`/sessions/${sessionId}/live`);
      setLiveData(data);
      setActiveSessionId(sessionId);

      // Join Socket room
      const socket = getSocket();
      if (socket) {
        socket.emit('join:session', sessionId);
        socket.off('attendance:marked');
        socket.on('attendance:marked', (payload: any) => {
          setLiveData((prev) => {
            if (!prev) return prev;
            const exists = prev.students.some((s) => s.id === payload.student.id);
            if (exists) return prev;
            return {
              ...prev,
              count: payload.count,
              total: payload.total,
              students: [
                {
                  id: payload.student.id,
                  name: payload.student.name,
                  rollNo: payload.student.rollNo,
                  markedAt: payload.markedAt,
                },
                ...prev.students,
              ],
            };
          });
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to open live view');
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const newSession = await apiRequest<ClassSession>('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: createForm.subjectId,
          startsAt: new Date(createForm.startsAt).toISOString(),
          endsAt: new Date(createForm.endsAt).toISOString(),
          windowMinutes: Number(createForm.windowMinutes),
        }),
      });

      setShowCreateModal(false);
      await loadTeacherData();
      // Auto open live session
      loadLiveSession(newSession.id);
    } catch (err: any) {
      alert(err.message || 'Failed to create session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenSession = async (sessionId: string) => {
    try {
      await apiRequest(`/sessions/${sessionId}/open`, { method: 'POST' });
      await loadTeacherData();
      loadLiveSession(sessionId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExtendWindow = async (sessionId: string, minutes: number) => {
    try {
      await apiRequest(`/sessions/${sessionId}/extend`, {
        method: 'POST',
        body: JSON.stringify({ minutes }),
      });
      loadLiveSession(sessionId);
      loadTeacherData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCloseWindow = async (sessionId: string) => {
    try {
      await apiRequest(`/sessions/${sessionId}/close`, { method: 'POST' });
      loadLiveSession(sessionId);
      loadTeacherData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFinalize = async (sessionId: string) => {
    if (!confirm('Finalizing this session will mark all non-attending enrolled students as ABSENT. Continue?')) {
      return;
    }
    try {
      await apiRequest(`/sessions/${sessionId}/finalize`, { method: 'POST' });
      loadLiveSession(sessionId);
      loadTeacherData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const downloadReport = (subjectId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    window.open(`/api/v1/reports/export/csv?subjectId=${subjectId}&from=${from}&to=${today}`, '_blank');
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Top Header & Launch Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            Faculty Lecture & Attendance Console
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Schedule lectures, broadcast live OTP class codes, manage subjects, and track real-time attendance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowNewSubjectModal(true)} className="btn btn-secondary">
            <BookOpen size={16} /> New Subject
          </button>
          <button onClick={openCreateSessionModal} className="btn btn-primary btn-lg">
            <PlusCircle size={20} />
            <span>Launch New Lecture</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedbackMessage && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          background: feedbackMessage.type === 'success' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
          border: `1.5px solid ${feedbackMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
          color: '#ffffff',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }} className="animate-fade-in">
          {feedbackMessage.type === 'success' ? <CheckCircle size={18} color="#34d399" /> : <AlertCircle size={18} color="#f87171" />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* ACTIVE LIVE SESSION SCREEN (IF SELECTED) */}
      {liveData && (
        <div className="glass-panel" style={{
          padding: '2.5rem',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          position: 'relative',
          overflow: 'hidden',
          background: 'rgba(15, 23, 42, 0.9)',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.2)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="badge badge-open">
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} className="animate-live-dot" />
                  Live Attendance Console
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  Session ID: {liveData.session.id.slice(0, 8)}...
                </span>
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
                {liveData.session.subject?.name || 'Class Session'} ({liveData.session.subject?.code})
              </h2>
            </div>

            {/* Live Controls */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {liveData.session.status === 'SCHEDULED' && (
                <button onClick={() => handleOpenSession(liveData.session.id)} className="btn btn-success">
                  <Play size={16} /> Open Check-In Now
                </button>
              )}
              {liveData.session.status === 'OPEN' && (
                <>
                  <button onClick={() => handleExtendWindow(liveData.session.id, 5)} className="btn btn-secondary">
                    +5 Min Extend
                  </button>
                  <button onClick={() => handleCloseWindow(liveData.session.id)} className="btn btn-secondary" style={{ color: '#fbbf24' }}>
                    <StopCircle size={16} /> Close Window
                  </button>
                </>
              )}
              {liveData.session.status !== 'FINALIZED' && (
                <button onClick={() => handleFinalize(liveData.session.id)} className="btn btn-danger">
                  <Lock size={16} /> Finalize Attendance
                </button>
              )}
              <button onClick={() => setActiveSessionId(null)} className="btn btn-secondary btn-sm">
                Minimize
              </button>
            </div>
          </div>

          {/* Central Live Billboard: Class Code & Count */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '2rem',
            padding: '2rem',
            borderRadius: 'var(--radius-xl)',
            background: 'rgba(9, 13, 22, 0.7)',
            border: '1px solid var(--border-glass)',
            marginBottom: '2rem',
          }}>
            {/* BIG PROJECTION CODE FOR CLASSROOM BOARD */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Classroom Projection Code
              </span>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '3.5rem',
                fontWeight: 900,
                letterSpacing: '0.2em',
                color: '#38bdf8',
                textShadow: '0 0 30px rgba(56, 189, 248, 0.6)',
                margin: '0.5rem 0',
                padding: '0.5rem 2rem',
                borderRadius: '16px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '2px dashed rgba(56, 189, 248, 0.4)',
              }}>
                {liveData.session.classCode}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                {liveData.session.status === 'OPEN'
                  ? `Window closes at ${new Date(liveData.session.windowClosesAt).toLocaleTimeString()}`
                  : `Status: ${liveData.session.status}`}
              </span>
            </div>

            {/* LIVE PARTICIPATION METER */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Live Attendee Turnout
                </span>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>
                  {liveData.count} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>/ {liveData.total}</span>
                </span>
              </div>

              {/* Progress bar */}
              <div className="progress-track" style={{ height: '14px', marginBottom: '1rem' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${liveData.total > 0 ? (liveData.count / liveData.total) * 100 : 0}%`,
                    background: 'linear-gradient(90deg, #6366f1 0%, #10b981 100%)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                <span>Turnout: {liveData.total > 0 ? Math.round((liveData.count / liveData.total) * 100) : 0}%</span>
                <span>Enrolled: {liveData.total} Students</span>
              </div>
            </div>
          </div>

          {/* STREAMING ATTENDANCE FEED */}
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="#818cf8" />
              <span>Real-Time Check-In Stream ({liveData.students.length})</span>
            </h3>

            {liveData.students.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', background: 'rgba(30, 41, 59, 0.3)', borderRadius: '12px' }}>
                Waiting for student check-ins... Students entering the code will appear here live.
              </div>
            ) : (
              <div style={{
                maxHeight: '320px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '10px',
              }}>
                {liveData.students.map((student) => (
                  <div key={student.id} style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }} className="animate-slide-up">
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                        {student.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {student.rollNo || 'Student'}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
                      {new Date(student.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OWNED SUBJECTS & QUICK STATS */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={20} color="#6366f1" />
            <span>My Assigned Subjects ({mySubjects.length})</span>
          </h2>
          <button
            onClick={() => setShowNewSubjectModal(true)}
            className="btn btn-secondary btn-sm"
            style={{ color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.4)' }}
          >
            <PlusCircle size={14} /> + Add Subject
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1.25rem',
        }}>
          {mySubjects.length === 0 ? (
            <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', gridColumn: '1 / -1' }}>
              <BookOpen size={36} color="#818cf8" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
                No subjects created yet
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
                Create your first course subject to begin scheduling lectures and tracking real-time student check-ins.
              </p>
              <button
                onClick={() => setShowNewSubjectModal(true)}
                className="btn btn-primary"
              >
                <PlusCircle size={16} /> Create Your First Subject
              </button>
            </div>
          ) : (
            mySubjects.map((sub: any) => (
              <div key={sub.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase' }}>
                      {sub.code}
                    </span>
                    <span className="badge badge-scheduled">
                      {sub._count?.enrollments || 0} Students
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                    {sub.name}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Completed Lectures: {sub._count?.sessions || 0}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '1.5rem' }}>
                  <button
                    onClick={() => {
                      setCreateForm((prev) => ({ ...prev, subjectId: sub.id }));
                      setShowCreateModal(true);
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                  >
                    <PlusCircle size={14} /> Schedule
                  </button>
                  <button
                    onClick={() => openEditSubject(sub)}
                    className="btn btn-secondary btn-sm"
                    style={{ color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.35)' }}
                    title="Manually Edit Subject Code & Name"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    onClick={() => downloadReport(sub.id)}
                    className="btn btn-secondary btn-sm"
                    title="Export Attendance CSV"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RECENT SESSIONS TABLE */}
      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} color="#06b6d4" />
          <span>Recent Class Sessions</span>
        </h2>

        <div className="glass-panel" style={{ overflowX: 'auto', padding: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Subject</th>
                <th style={{ padding: '12px 16px' }}>Class Code</th>
                <th style={{ padding: '12px 16px' }}>Schedule</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    No sessions scheduled yet. Click "Launch New Lecture" above to create one.
                  </td>
                </tr>
              ) : (
                sessions.map((sess) => (
                  <tr key={sess.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>{sess.subject?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>{sess.subject?.code}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>
                        {sess.classCode}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                      {new Date(sess.startsAt).toLocaleDateString()} {new Date(sess.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge badge-${sess.status.toLowerCase()}`}>
                        {sess.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => loadLiveSession(sess.id)}
                        className="btn btn-secondary btn-sm"
                      >
                        <Maximize2 size={13} /> View Live
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE SESSION MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Schedule a Lecture Session
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Specify the lecture duration and check-in window. A unique class code will be generated.
            </p>

            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Select Subject
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {createForm.subjectId && (
                      <button
                        type="button"
                        onClick={() => {
                          const current = subjects.find((s) => s.id === createForm.subjectId);
                          if (current) openEditSubject(current);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 10px', fontSize: '0.75rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Edit selected subject details"
                      >
                        <Pencil size={12} /> Edit Subject
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNewSubjectModal(true)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 10px', fontSize: '0.75rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <PlusCircle size={12} /> + Add
                    </button>
                  </div>
                </div>
                <select
                  id="lecture-subject-select"
                  value={createForm.subjectId}
                  onChange={(e) => setCreateForm({ ...createForm, subjectId: e.target.value })}
                  className="input-field"
                  style={{
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    backgroundColor: '#0f172a',
                    border: '1.5px solid rgba(255, 255, 255, 0.35)',
                  }}
                  required
                >
                  {subjects.length === 0 ? (
                    <option value="" disabled style={{ background: '#0f172a', color: '#94a3b8' }}>
                      -- No subjects created yet. Click "+ Add" above to create one --
                    </option>
                  ) : (
                    <>
                      {!createForm.subjectId && (
                        <option value="" disabled style={{ background: '#0f172a', color: '#94a3b8' }}>
                          -- Choose a Subject ({subjects.length} Available) --
                        </option>
                      )}
                      {mySubjects.length > 0 && (
                        <optgroup label="My Created / Assigned Subjects" style={{ background: '#0f172a', color: '#818cf8', fontWeight: 700 }}>
                          {mySubjects.map((sub: any) => (
                            <option key={sub.id} value={sub.id} style={{ background: '#0f172a', color: '#ffffff', fontWeight: 500 }}>
                              {sub.code} — {sub.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherSubjects.length > 0 && (
                        <optgroup label="Other Curriculum Subjects" style={{ background: '#0f172a', color: '#38bdf8', fontWeight: 700 }}>
                          {otherSubjects.map((sub: any) => (
                            <option key={sub.id} value={sub.id} style={{ background: '#0f172a', color: '#ffffff', fontWeight: 500 }}>
                              {sub.code} — {sub.name} {sub.teacher?.name ? `(${sub.teacher.name})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  )}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Lecture Starts At
                  </label>
                  <input
                    type="datetime-local"
                    value={createForm.startsAt}
                    onChange={(e) => setCreateForm({ ...createForm, startsAt: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Lecture Ends At
                  </label>
                  <input
                    type="datetime-local"
                    value={createForm.endsAt}
                    onChange={(e) => setCreateForm({ ...createForm, endsAt: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Check-In Window (Minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={createForm.windowMinutes}
                  onChange={(e) => setCreateForm({ ...createForm, windowMinutes: Number(e.target.value) })}
                  className="input-field"
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                  Students must submit the code within this window from lecture start.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary">
                  {actionLoading ? 'Creating...' : 'Create & Launch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUBJECT MODAL (TEACHER MANUAL EDIT) */}
      {editingSubject && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }} onClick={() => setEditingSubject(null)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                  Edit Subject Details
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Update the subject code or course name directly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSubject(null)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSubject} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="form-label">Subject Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS301"
                  value={editSubjectForm.code}
                  onChange={(e) => setEditSubjectForm({ ...editSubjectForm, code: e.target.value.toUpperCase() })}
                  className="input-field"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                  Unique departmental course identifier (e.g. CS301, IT204).
                </span>
              </div>

              <div>
                <label className="form-label">Subject Name / Course Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Database Management Systems"
                  value={editSubjectForm.name}
                  onChange={(e) => setEditSubjectForm({ ...editSubjectForm, name: e.target.value })}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={subjectActionLoading}
                  className="btn btn-primary"
                >
                  {subjectActionLoading ? 'Saving...' : 'Save Subject Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW SUBJECT MODAL (TEACHER) */}
      {showNewSubjectModal && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }} onClick={() => setShowNewSubjectModal(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                  Add New Academic Subject
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Create and assign a new course subject to your profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewSubjectModal(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewSubject} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="form-label">Subject Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS305"
                  value={newSubjectForm.code}
                  onChange={(e) => setNewSubjectForm({ ...newSubjectForm, code: e.target.value.toUpperCase() })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="form-label">Subject Name / Course Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud Computing & DevOps"
                  value={newSubjectForm.name}
                  onChange={(e) => setNewSubjectForm({ ...newSubjectForm, name: e.target.value })}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowNewSubjectModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={subjectActionLoading}
                  className="btn btn-primary"
                >
                  {subjectActionLoading ? 'Creating...' : 'Create & Assign Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
