import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { StudentDashboard } from './components/StudentDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AdminDashboard } from './components/AdminDashboard';

const MainApp: React.FC = () => {
  const { user, loading, login } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '3px solid rgba(99, 102, 241, 0.2)',
            borderTopColor: '#6366f1',
            animation: 'spin 1s infinite linear',
          }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
            Connecting to Srusti Portal...
          </span>
        </div>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const handleQuickSwitch = async (email: string) => {
    try {
      await login(email, 'Password123');
    } catch (err: any) {
      alert('Quick switch failed: ' + err.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar onSwitchUser={handleQuickSwitch} />
      <main style={{ flex: 1 }}>
        {user.role === 'STUDENT' && <StudentDashboard />}
        {user.role === 'TEACHER' && <TeacherDashboard />}
        {user.role === 'ADMIN' && <AdminDashboard />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
