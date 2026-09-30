import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../lib/api';
import {
  Users,
  Shield,
  BookOpen,
  UserPlus,
  RefreshCw,
  Search,
  KeyRound,
  FileText,
  Activity,
  CheckCircle,
  AlertCircle,
  GraduationCap,
  Award,
  Filter,
  PlusCircle,
  Pencil,
  Check,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { User, Subject } from '../types';

type AdminTab = 'students' | 'teachers' | 'subjects' | 'audit';

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [currentTab, setCurrentTab] = useState<AdminTab>('students');
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [attendanceFilter, setAttendanceFilter] = useState<string>('all'); // all, good, warning, critical

  // Modals
  const [showAddUser, setShowAddUser] = useState<boolean>(false);
  const [showAddSubject, setShowAddSubject] = useState<boolean>(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [enrollModalUser, setEnrollModalUser] = useState<User | null>(null);
  const [selectedSubjectToEnroll, setSelectedSubjectToEnroll] = useState<string>('');

  // Forms
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role: 'STUDENT' as 'STUDENT' | 'TEACHER',
    rollNo: '',
  });

  const [subjectForm, setSubjectForm] = useState({
    code: '',
    name: '',
    teacherId: '',
  });

  const [editSubjectForm, setEditSubjectForm] = useState({
    code: '',
    name: '',
    teacherId: '',
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, subsRes, logsRes] = await Promise.all([
        apiRequest<{ users: User[] }>('/admin/users?limit=300'),
        apiRequest<Subject[]>('/admin/subjects'),
        apiRequest<{ logs: any[] }>('/admin/audit-logs?limit=50').catch(() => ({ logs: [] })),
      ]);
      setUsers(usersRes.users || []);
      setSubjects(subsRes || []);
      setAuditLogs(logsRes.logs || []);

      if (subsRes.length > 0 && !subjectForm.teacherId) {
        const firstTeacher = usersRes.users.find((u) => u.role === 'TEACHER');
        if (firstTeacher) {
          setSubjectForm((prev) => ({ ...prev, teacherId: firstTeacher.id }));
        }
      }
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Separate Teachers and Students
  const teachers = useMemo(() => users.filter((u) => u.role === 'TEACHER'), [users]);
  const students = useMemo(() => users.filter((u) => u.role === 'STUDENT'), [users]);

  // Overall campus attendance average
  const campusAverageAttendance = useMemo(() => {
    if (students.length === 0) return 0;
    const totalPct = students.reduce((acc, s) => acc + (s.attendanceStats?.percentage ?? 100), 0);
    return Math.round(totalPct / students.length);
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.rollNo && s.rollNo.toLowerCase().includes(q));

      if (!matchSearch) return false;

      // Subject filter
      if (subjectFilter) {
        const isEnrolled = s.enrollments?.some(
          (e) => e.subject.id === subjectFilter || e.subject.code === subjectFilter
        );
        if (!isEnrolled) return false;
      }

      // Attendance health filter
      if (attendanceFilter !== 'all') {
        const pct = s.attendanceStats?.percentage ?? 100;
        if (attendanceFilter === 'good' && pct < 75) return false;
        if (attendanceFilter === 'warning' && (pct < 50 || pct >= 75)) return false;
        if (attendanceFilter === 'critical' && pct >= 50) return false;
      }

      return true;
    });
  }, [students, searchQuery, subjectFilter, attendanceFilter]);

  // Filtered Teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.taughtSubjects?.some((sub) => sub.code.toLowerCase().includes(q) || sub.name.toLowerCase().includes(q))
      );
    });
  }, [teachers, searchQuery]);

  // Handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<any>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(userForm),
      });
      setShowAddUser(false);
      setUserForm({ name: '', email: '', role: 'STUDENT', rollNo: '' });
      notify(`Created user "${res.name}" (${res.role}). Temporary password: ${res.generatedPassword || 'Default generated'}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newSub = await apiRequest<Subject>('/admin/subjects', {
        method: 'POST',
        body: JSON.stringify(subjectForm),
      });
      setShowAddSubject(false);
      setSubjectForm({ code: '', name: '', teacherId: teachers[0]?.id || '' });
      notify(`Created course subject "${newSub.code} - ${newSub.name}"`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create subject');
    }
  };

  const openEditSubject = (sub: Subject) => {
    setEditingSubject(sub);
    setEditSubjectForm({
      code: sub.code,
      name: sub.name,
      teacherId: sub.teacherId || '',
    });
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    try {
      await apiRequest(`/admin/subjects/${editingSubject.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          code: editSubjectForm.code.trim().toUpperCase(),
          name: editSubjectForm.name.trim(),
          teacherId: editSubjectForm.teacherId || undefined,
        }),
      });
      setEditingSubject(null);
      notify('Subject successfully updated!');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update subject');
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    if (!confirm(`Reset temporary password for ${email}?`)) return;
    try {
      const res = await apiRequest<{ password: string }>(`/admin/users/${userId}/reset-password`, {
        method: 'POST',
      });
      alert(`Password reset successfully!\n\nUser: ${email}\nNew Temporary Password: ${res.password}`);
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollModalUser || !selectedSubjectToEnroll) return;
    try {
      await apiRequest('/admin/enrollments', {
        method: 'POST',
        body: JSON.stringify({
          studentId: enrollModalUser.id,
          subjectId: selectedSubjectToEnroll,
        }),
      });
      notify(`Student enrolled into course!`);
      setEnrollModalUser(null);
      setSelectedSubjectToEnroll('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to enroll student');
    }
  };

  const handleUnenrollStudent = async (studentId: string, subjectId: string, subjectCode: string) => {
    if (!confirm(`Remove student from course ${subjectCode}?`)) return;
    try {
      await apiRequest(`/admin/enrollments/${studentId}/${subjectId}`, {
        method: 'DELETE',
      });
      notify(`Unenrolled from ${subjectCode}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to unenroll');
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      await apiRequest(`/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      notify(`User ${user.name} is now ${!user.isActive ? 'Active' : 'Deactivated'}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* TOP BANNER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-scheduled" style={{ letterSpacing: '0.05em' }}>
              ADMINISTRATIVE CONTROL PANEL
            </span>
            <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              Live Neon DB Synced
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em', marginTop: '6px' }}>
            University Academic & Campus Administration
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Full access to all teacher records, student profiles, attendance metrics, and curriculum allocations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => setShowAddSubject(true)} className="btn btn-secondary">
            <BookOpen size={16} /> New Subject
          </button>
          <button onClick={() => setShowAddUser(true)} className="btn btn-primary">
            <UserPlus size={16} /> Add User
          </button>
          <button onClick={loadData} className="btn btn-secondary btn-sm" title="Refresh Database Data">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
          border: `1.5px solid ${notification.type === 'success' ? '#10b981' : '#ef4444'}`,
          color: '#ffffff',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }} className="animate-fade-in">
          {notification.type === 'success' ? <CheckCircle size={18} color="#34d399" /> : <AlertCircle size={18} color="#f87171" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem',
      }}>
        {/* Total Students */}
        <div
          className="glass-panel"
          style={{
            padding: '1.5rem',
            cursor: 'pointer',
            border: currentTab === 'students' ? '1.5px solid #6366f1' : undefined,
          }}
          onClick={() => { setCurrentTab('students'); setSearchQuery(''); }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#818cf8', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Enrolled Students
            </span>
            <GraduationCap size={22} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff' }}>
            {students.length}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Active student body accounts in database
          </p>
        </div>

        {/* Total Faculty */}
        <div
          className="glass-panel"
          style={{
            padding: '1.5rem',
            cursor: 'pointer',
            border: currentTab === 'teachers' ? '1.5px solid #38bdf8' : undefined,
          }}
          onClick={() => { setCurrentTab('teachers'); setSearchQuery(''); }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Faculty Members
            </span>
            <Users size={22} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff' }}>
            {teachers.length}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Course instructors & lecturers
          </p>
        </div>

        {/* Academic Subjects */}
        <div
          className="glass-panel"
          style={{
            padding: '1.5rem',
            cursor: 'pointer',
            border: currentTab === 'subjects' ? '1.5px solid #34d399' : undefined,
          }}
          onClick={() => { setCurrentTab('subjects'); setSearchQuery(''); }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34d399', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Academic Courses
            </span>
            <BookOpen size={22} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff' }}>
            {subjects.length}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Active curriculum subjects
          </p>
        </div>

        {/* Campus Attendance Rate */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Campus Turnout
            </span>
            <Award size={22} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: campusAverageAttendance >= 75 ? '#34d399' : '#fbbf24' }}>
            {campusAverageAttendance}%
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Average attendance across all student lectures
          </p>
        </div>
      </div>

      {/* SEGMENTED TAB NAVIGATION */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid var(--border-glass)',
        paddingBottom: '4px',
        overflowX: 'auto',
      }}>
        <button
          onClick={() => { setCurrentTab('students'); setSearchQuery(''); }}
          style={{
            padding: '10px 18px',
            background: currentTab === 'students' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: currentTab === 'students' ? '2.5px solid #6366f1' : '2.5px solid transparent',
            color: currentTab === 'students' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: currentTab === 'students' ? 800 : 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '6px 6px 0 0',
            transition: 'all 0.2s',
          }}
        >
          <GraduationCap size={18} />
          <span>All Students Directory ({students.length})</span>
        </button>

        <button
          onClick={() => { setCurrentTab('teachers'); setSearchQuery(''); }}
          style={{
            padding: '10px 18px',
            background: currentTab === 'teachers' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: currentTab === 'teachers' ? '2.5px solid #38bdf8' : '2.5px solid transparent',
            color: currentTab === 'teachers' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: currentTab === 'teachers' ? 800 : 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '6px 6px 0 0',
            transition: 'all 0.2s',
          }}
        >
          <Users size={18} />
          <span>Faculty & Teachers ({teachers.length})</span>
        </button>

        <button
          onClick={() => { setCurrentTab('subjects'); setSearchQuery(''); }}
          style={{
            padding: '10px 18px',
            background: currentTab === 'subjects' ? 'rgba(52, 211, 153, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: currentTab === 'subjects' ? '2.5px solid #34d399' : '2.5px solid transparent',
            color: currentTab === 'subjects' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: currentTab === 'subjects' ? 800 : 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '6px 6px 0 0',
            transition: 'all 0.2s',
          }}
        >
          <BookOpen size={18} />
          <span>Subjects & Curriculum ({subjects.length})</span>
        </button>

        <button
          onClick={() => { setCurrentTab('audit'); setSearchQuery(''); }}
          style={{
            padding: '10px 18px',
            background: currentTab === 'audit' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: currentTab === 'audit' ? '2.5px solid #f59e0b' : '2.5px solid transparent',
            color: currentTab === 'audit' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: currentTab === 'audit' ? 800 : 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '6px 6px 0 0',
            transition: 'all 0.2s',
          }}
        >
          <Activity size={18} />
          <span>Security Audit Trail ({auditLogs.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: STUDENTS DIRECTORY (ALL STUDENTS WITH ENROLLED COURSES & ATTENDANCE)
          ========================================================================= */}
      {currentTab === 'students' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          {/* Header & Search / Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GraduationCap size={22} color="#818cf8" />
                <span>All Enrolled Students Directory ({filteredStudents.length} of {students.length})</span>
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Complete student records including roll numbers, enrolled courses, and real-time lecture attendance metrics.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {/* Search Typebox */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search name, roll no, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '36px', width: '240px' }}
                />
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '14px' }} />
              </div>

              {/* Subject Filter Dropdown */}
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="input-field"
                style={{ width: '160px' }}
              >
                <option value="">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} ({sub.name})
                  </option>
                ))}
              </select>

              {/* Attendance Health Filter */}
              <select
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value)}
                className="input-field"
                style={{ width: '160px' }}
              >
                <option value="all">All Attendance</option>
                <option value="good">Good (≥ 75%)</option>
                <option value="warning">Average (50-74%)</option>
                <option value="critical">At-Risk (&lt; 50%)</option>
              </select>
            </div>
          </div>

          {/* Students Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 14px' }}>Student Profile</th>
                  <th style={{ padding: '12px 14px' }}>Roll Number</th>
                  <th style={{ padding: '12px 14px' }}>Enrolled Courses</th>
                  <th style={{ padding: '12px 14px' }}>Lectures Attended</th>
                  <th style={{ padding: '12px 14px' }}>Attendance Rate</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No students matched your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => {
                    const stats = st.attendanceStats || { totalAttended: 0, totalSessions: 0, percentage: 100 };
                    const isGood = stats.percentage >= 75;
                    const isWarning = stats.percentage >= 50 && stats.percentage < 75;
                    const isCritical = stats.percentage < 50;

                    return (
                      <tr key={st.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}>
                        {/* Student Name & Email */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              color: '#ffffff',
                              fontSize: '0.85rem',
                              flexShrink: 0,
                            }}>
                              {st.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#f8fafc' }}>{st.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{st.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Roll Number */}
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(30, 41, 59, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#38bdf8',
                            fontSize: '0.8rem',
                          }}>
                            {st.rollNo || 'N/A'}
                          </span>
                        </td>

                        {/* Enrolled Courses */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '280px' }}>
                            {st.enrollments && st.enrollments.length > 0 ? (
                              st.enrollments.map((en) => (
                                <span
                                  key={en.subject.id}
                                  title={`${en.subject.code}: ${en.subject.name}`}
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    color: '#a5b4fc',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                  }}
                                >
                                  {en.subject.code}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>None</span>
                            )}
                          </div>
                        </td>

                        {/* Lectures Attended */}
                        <td style={{ padding: '12px 14px', color: '#e2e8f0', fontWeight: 600 }}>
                          {stats.totalAttended} <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>/ {stats.totalSessions} Sessions</span>
                        </td>

                        {/* Attendance Rate */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              color: isGood ? '#34d399' : isWarning ? '#fbbf24' : '#ef4444',
                              minWidth: '42px',
                            }}>
                              {stats.percentage}%
                            </span>
                            <div className="progress-track" style={{ width: '60px', height: '6px' }}>
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${Math.min(100, stats.percentage)}%`,
                                  background: isGood ? '#10b981' : isWarning ? '#f59e0b' : '#ef4444',
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 14px' }}>
                          <span className={`badge ${st.isActive !== false ? 'badge-present' : 'badge-absent'}`}>
                            {st.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => {
                                setEnrollModalUser(st);
                                setSelectedSubjectToEnroll(subjects[0]?.id || '');
                              }}
                              className="btn btn-secondary btn-sm"
                              title="Enroll into a course"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#818cf8' }}
                            >
                              + Course
                            </button>
                            <button
                              onClick={() => handleResetPassword(st.id, st.email)}
                              className="btn btn-secondary btn-sm"
                              title="Reset Password"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              <KeyRound size={12} />
                            </button>
                            <button
                              onClick={() => handleToggleUserStatus(st)}
                              className="btn btn-secondary btn-sm"
                              title={st.isActive !== false ? 'Deactivate Account' : 'Activate Account'}
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: st.isActive !== false ? '#f87171' : '#34d399' }}
                            >
                              {st.isActive !== false ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: FACULTY & TEACHERS DIRECTORY
          ========================================================================= */}
      {currentTab === 'teachers' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={22} color="#38bdf8" />
                <span>Faculty & Instructors Directory ({filteredTeachers.length})</span>
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Teaching staff accounts, assigned departmental courses, enrolled attendee totals, and lectures conducted.
              </p>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search teacher name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '36px', width: '260px' }}
              />
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '14px' }} />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 14px' }}>Instructor Profile</th>
                  <th style={{ padding: '12px 14px' }}>Assigned Subjects / Courses</th>
                  <th style={{ padding: '12px 14px' }}>Total Enrolled Students</th>
                  <th style={{ padding: '12px 14px' }}>Lectures Conducted</th>
                  <th style={{ padding: '12px 14px' }}>Account Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((tc) => (
                  <tr key={tc.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          color: '#ffffff',
                          fontSize: '0.9rem',
                          flexShrink: 0,
                        }}>
                          {tc.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#f8fafc' }}>{tc.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tc.email}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {tc.taughtSubjects && tc.taughtSubjects.length > 0 ? (
                          tc.taughtSubjects.map((sub) => (
                            <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                color: '#38bdf8',
                                background: 'rgba(6, 182, 212, 0.15)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid rgba(6, 182, 212, 0.3)',
                              }}>
                                {sub.code}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>{sub.name}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                ({sub._count?.enrollments || 0} students)
                              </span>
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>No subjects assigned</span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#ffffff' }}>
                      {tc.totalStudentsTaught || 0} Students
                    </td>

                    <td style={{ padding: '12px 14px', color: '#e2e8f0' }}>
                      {tc.totalSessionsConducted || 0} Lectures
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge ${tc.isActive !== false ? 'badge-present' : 'badge-absent'}`}>
                        {tc.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleResetPassword(tc.id, tc.email)}
                          className="btn btn-secondary btn-sm"
                          title="Reset Password"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        >
                          <KeyRound size={12} /> Reset Password
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(tc)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', color: tc.isActive !== false ? '#f87171' : '#34d399' }}
                        >
                          {tc.isActive !== false ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: SUBJECTS & CURRICULUM DIRECTORY
          ========================================================================= */}
      {currentTab === 'subjects' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={22} color="#34d399" />
                <span>Academic Subjects & Curriculum ({subjects.length})</span>
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Course catalog, professor assignment, enrolled student rosters, and lecture counts.
              </p>
            </div>

            <button onClick={() => setShowAddSubject(true)} className="btn btn-primary btn-sm">
              <PlusCircle size={15} /> Add Course Subject
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 14px' }}>Course Code & Title</th>
                  <th style={{ padding: '12px 14px' }}>Assigned Faculty Instructor</th>
                  <th style={{ padding: '12px 14px' }}>Enrolled Students</th>
                  <th style={{ padding: '12px 14px' }}>Sessions Completed</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((sub) => (
                  <tr key={sub.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          color: '#34d399',
                          background: 'rgba(16, 185, 129, 0.15)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                        }}>
                          {sub.code}
                        </span>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{sub.name}</div>
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      {sub.teacher ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{sub.teacher.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub.teacher.email}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>Unassigned</span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <span className="badge badge-scheduled">
                        {sub._count?.enrollments || 0} Students
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px', color: '#e2e8f0' }}>
                      {sub._count?.sessions || 0} Lectures
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        onClick={() => openEditSubject(sub)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.3)' }}
                      >
                        <Pencil size={12} /> Edit Course
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: SECURITY AUDIT LOGS
          ========================================================================= */}
      {currentTab === 'audit' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="#f59e0b" />
            <span>Real-Time Security & Compliance Audit Stream</span>
          </h2>

          <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {auditLogs.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                No audit events recorded yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.85rem',
                }}>
                  <div>
                    <span style={{ fontWeight: 800, color: '#818cf8', marginRight: '10px' }}>
                      {log.action}
                    </span>
                    <span style={{ color: 'var(--text-main)' }}>
                      {log.entity} {log.entityId ? `(#${log.entityId.slice(0, 8)})` : ''}
                    </span>
                  </div>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
          ========================================================================= */}

      {/* ADD USER MODAL */}
      {showAddUser && (
        <div className="modal-backdrop" onClick={() => setShowAddUser(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: '#f8fafc' }}>
              Add New User Account
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Create a new faculty instructor or student account. A secure temporary password will be generated.
            </p>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Rajesh Kumar or Rohan Sen"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. name@college.edu"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="form-label">Account Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                  className="input-field"
                >
                  <option value="STUDENT">STUDENT (Roll No Required)</option>
                  <option value="TEACHER">TEACHER / FACULTY</option>
                </select>
              </div>

              {userForm.role === 'STUDENT' && (
                <div>
                  <label className="form-label">Student Roll Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 21CS061"
                    value={userForm.rollNo}
                    onChange={(e) => setUserForm({ ...userForm, rollNo: e.target.value.toUpperCase() })}
                    className="input-field"
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddUser(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SUBJECT MODAL */}
      {showAddSubject && (
        <div className="modal-backdrop" onClick={() => setShowAddSubject(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: '#f8fafc' }}>
              Create Academic Course Subject
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Define a new course code, title, and designate an instructor in charge.
            </p>

            <form onSubmit={handleCreateSubject} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label className="form-label">Subject Code</label>
                <input
                  type="text"
                  placeholder="e.g. CS305"
                  required
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="form-label">Subject Name / Course Title</label>
                <input
                  type="text"
                  placeholder="e.g. Mobile Computing & Cloud"
                  required
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="form-label">Assigned Faculty Professor</label>
                <select
                  value={subjectForm.teacherId}
                  onChange={(e) => setSubjectForm({ ...subjectForm, teacherId: e.target.value })}
                  className="input-field"
                  required
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddSubject(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUBJECT MODAL (ADMIN) */}
      {editingSubject && (
        <div className="modal-backdrop" onClick={() => setEditingSubject(null)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: '#f8fafc' }}>
              Edit Course Subject
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Modify subject code, name, or reassign faculty professor.
            </p>

            <form onSubmit={handleUpdateSubject} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div>
                <label className="form-label">Course Code</label>
                <input
                  type="text"
                  required
                  value={editSubjectForm.code}
                  onChange={(e) => setEditSubjectForm({ ...editSubjectForm, code: e.target.value.toUpperCase() })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="form-label">Course Name</label>
                <input
                  type="text"
                  required
                  value={editSubjectForm.name}
                  onChange={(e) => setEditSubjectForm({ ...editSubjectForm, name: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="form-label">Assigned Faculty Professor</label>
                <select
                  value={editSubjectForm.teacherId}
                  onChange={(e) => setEditSubjectForm({ ...editSubjectForm, teacherId: e.target.value })}
                  className="input-field"
                  required
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
                <button type="button" onClick={() => setEditingSubject(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ENROLL STUDENT MODAL */}
      {enrollModalUser && (
        <div className="modal-backdrop" onClick={() => setEnrollModalUser(null)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem', color: '#f8fafc' }}>
              Enroll Student into Course
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Student: <strong style={{ color: '#ffffff' }}>{enrollModalUser.name}</strong> ({enrollModalUser.rollNo})
            </p>

            <form onSubmit={handleEnrollStudent} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="form-label">Select Course to Enroll</label>
                <select
                  value={selectedSubjectToEnroll}
                  onChange={(e) => setSelectedSubjectToEnroll(e.target.value)}
                  className="input-field"
                  required
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setEnrollModalUser(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Enrollment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
