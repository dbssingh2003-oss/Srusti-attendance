export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';
export type SessionStatus = 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'FINALIZED' | 'CANCELLED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  rollNo?: string | null;
  isActive?: boolean;
  createdAt?: string;
  taughtSubjects?: Array<{
    id: string;
    code: string;
    name: string;
    _count?: { enrollments: number; sessions: number };
  }>;
  enrollments?: Array<{
    subject: {
      id: string;
      code: string;
      name: string;
      _count?: { sessions: number };
    };
  }>;
  attendanceStats?: {
    totalAttended: number;
    totalSessions: number;
    percentage: number;
  };
  totalStudentsTaught?: number;
  totalSessionsConducted?: number;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  teacherId: string;
  teacher?: User;
  _count?: {
    enrollments: number;
    sessions: number;
  };
}

export interface ClassSession {
  id: string;
  subjectId: string;
  classCode: string;
  startsAt: string;
  endsAt: string;
  windowOpensAt: string;
  windowClosesAt: string;
  windowExtended: boolean;
  status: SessionStatus;
  finalizedAt?: string | null;
  subject?: {
    code: string;
    name: string;
  };
}

export interface StudentQuickSummary {
  subjectId: string;
  present: number;
  total: number;
  pct: number;
}

export interface LiveSessionData {
  session: ClassSession;
  count: number;
  total: number;
  students: Array<{
    id: string;
    name: string;
    rollNo: string | null;
    markedAt: string;
  }>;
}
