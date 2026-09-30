"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const argon2 = __importStar(require("argon2"));
const prisma = new client_1.PrismaClient();
async function hashPassword(password) {
    return argon2.hash(password, { type: argon2.argon2id });
}
async function main() {
    console.log('🌱 Seeding database...');
    // Clear existing data (order matters due to FK constraints)
    await prisma.auditLog.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.classSession.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.subject.deleteMany();
    await prisma.user.deleteMany();
    const defaultPassword = await hashPassword('Password123');
    // ===== CREATE ADMIN =====
    const admin = await prisma.user.create({
        data: {
            email: 'admin@college.edu',
            name: 'System Admin',
            role: 'ADMIN',
            passwordHash: defaultPassword,
            mustChangePassword: false,
        },
    });
    console.log(`  ✅ Admin: admin@college.edu / Password123`);
    // ===== CREATE TEACHERS =====
    const teachers = await Promise.all([
        prisma.user.create({
            data: {
                email: 'rajesh.kumar@college.edu',
                name: 'Dr. Rajesh Kumar',
                role: 'TEACHER',
                passwordHash: defaultPassword,
                mustChangePassword: false,
            },
        }),
        prisma.user.create({
            data: {
                email: 'priya.sharma@college.edu',
                name: 'Prof. Priya Sharma',
                role: 'TEACHER',
                passwordHash: defaultPassword,
                mustChangePassword: false,
            },
        }),
        prisma.user.create({
            data: {
                email: 'anand.patel@college.edu',
                name: 'Dr. Anand Patel',
                role: 'TEACHER',
                passwordHash: defaultPassword,
                mustChangePassword: false,
            },
        }),
    ]);
    console.log(`  ✅ 3 Teachers created (password: Password123)`);
    // ===== CREATE SUBJECTS =====
    const subjects = await Promise.all([
        prisma.subject.create({
            data: { code: 'CS301', name: 'Data Structures & Algorithms', teacherId: teachers[0].id },
        }),
        prisma.subject.create({
            data: { code: 'CS302', name: 'Database Management Systems', teacherId: teachers[0].id },
        }),
        prisma.subject.create({
            data: { code: 'CS303', name: 'Operating Systems', teacherId: teachers[1].id },
        }),
        prisma.subject.create({
            data: { code: 'CS304', name: 'Computer Networks', teacherId: teachers[2].id },
        }),
    ]);
    console.log(`  ✅ 4 Subjects created`);
    // ===== CREATE STUDENTS =====
    const students = [];
    for (let i = 1; i <= 60; i++) {
        const rollNo = `21CS${String(i).padStart(3, '0')}`;
        const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
        const lastName = LAST_NAMES[i % LAST_NAMES.length];
        const name = `${firstName} ${lastName}`;
        const email = `${rollNo.toLowerCase()}@college.edu`;
        const student = await prisma.user.create({
            data: {
                email,
                name,
                rollNo,
                role: 'STUDENT',
                passwordHash: defaultPassword,
                mustChangePassword: false,
            },
        });
        students.push(student);
    }
    console.log(`  ✅ 60 Students created (password: Password123)`);
    // ===== CREATE ENROLLMENTS =====
    // Enroll all students in CS301 and CS302, first 40 in CS303, first 30 in CS304
    for (const student of students) {
        await prisma.enrollment.create({
            data: { studentId: student.id, subjectId: subjects[0].id },
        });
        await prisma.enrollment.create({
            data: { studentId: student.id, subjectId: subjects[1].id },
        });
    }
    for (const student of students.slice(0, 40)) {
        await prisma.enrollment.create({
            data: { studentId: student.id, subjectId: subjects[2].id },
        });
    }
    for (const student of students.slice(0, 30)) {
        await prisma.enrollment.create({
            data: { studentId: student.id, subjectId: subjects[3].id },
        });
    }
    console.log(`  ✅ Enrollments created`);
    // ===== CREATE SOME FINALIZED SESSIONS WITH ATTENDANCE =====
    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;
    for (let dayOffset = 5; dayOffset >= 1; dayOffset--) {
        const dayDate = new Date(now.getTime() - dayOffset * oneDayMs);
        dayDate.setHours(10, 0, 0, 0);
        const session = await prisma.classSession.create({
            data: {
                subjectId: subjects[0].id,
                classCode: `SEED${String(dayOffset).padStart(2, '0')}`,
                startsAt: new Date(dayDate),
                endsAt: new Date(dayDate.getTime() + 60 * 60_000),
                windowOpensAt: new Date(dayDate),
                windowClosesAt: new Date(dayDate.getTime() + 10 * 60_000),
                status: 'FINALIZED',
                finalizedAt: new Date(dayDate.getTime() + 60 * 60_000),
                createdById: teachers[0].id,
            },
        });
        // Mark ~80% of students present (random)
        for (const student of students) {
            const isPresent = Math.random() < 0.8;
            await prisma.attendance.create({
                data: {
                    sessionId: session.id,
                    studentId: student.id,
                    status: isPresent ? 'PRESENT' : 'ABSENT',
                    markedAt: isPresent ? new Date(dayDate.getTime() + Math.random() * 10 * 60_000) : null,
                },
            });
        }
    }
    console.log(`  ✅ 5 finalized sessions with mixed attendance created`);
    console.log('\n🎉 Seed complete!\n');
    console.log('Login credentials (all passwords: Password123):');
    console.log('  Admin:   admin@college.edu');
    console.log('  Teacher: rajesh.kumar@college.edu');
    console.log('  Teacher: priya.sharma@college.edu');
    console.log('  Teacher: anand.patel@college.edu');
    console.log('  Student: 21cs001@college.edu (Roll: 21CS001)');
    console.log('  ... through 21cs060@college.edu (Roll: 21CS060)');
}
const FIRST_NAMES = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan',
    'Krishna', 'Ishaan', 'Shaurya', 'Atharva', 'Advait', 'Dhruv', 'Kabir',
    'Ananya', 'Diya', 'Myra', 'Sara', 'Aadhya', 'Isha', 'Kiara', 'Riya',
    'Prisha', 'Anika', 'Nisha', 'Meera', 'Kavya', 'Tara', 'Zara',
];
const LAST_NAMES = [
    'Patel', 'Sharma', 'Gupta', 'Singh', 'Kumar', 'Reddy', 'Joshi', 'Rao',
    'Desai', 'Mehta', 'Shah', 'Nair', 'Pillai', 'Menon', 'Iyer', 'Chopra',
    'Verma', 'Mishra', 'Saxena', 'Bhat', 'Hegde', 'Kulkarni', 'Patil', 'Kaur',
    'Das', 'Mukherjee', 'Roy', 'Sen', 'Ghosh', 'Banerjee',
];
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map