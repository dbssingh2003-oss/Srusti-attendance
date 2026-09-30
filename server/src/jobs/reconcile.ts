import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { finalizeSession, openSession, closeWindow } from '../modules/sessions/service';
import { emitSessionOpened, emitSessionClosed, emitSessionFinalized } from '../realtime/emitters';

/**
 * Reconciliation sweeper — runs every minute.
 * Self-heals missed jobs by checking for sessions that should have transitioned.
 */
export async function reconcile() {
  const now = new Date();

  try {
    // 1. Open sessions that should be open (SCHEDULED and window has opened)
    const toOpen = await prisma.classSession.findMany({
      where: {
        status: 'SCHEDULED',
        windowOpensAt: { lte: now },
      },
      include: { subject: { select: { name: true } } },
    });

    for (const s of toOpen) {
      try {
        await openSession(s.id);
        emitSessionOpened(s.subjectId, s.id, s.subject.name, s.windowClosesAt);
        logger.info({ sessionId: s.id }, 'Reconciler: opened session');
      } catch (err) {
        logger.error({ err, sessionId: s.id }, 'Reconciler: failed to open session');
      }
    }

    // 2. Close windows that should be closed (OPEN and window has passed)
    const toClose = await prisma.classSession.findMany({
      where: {
        status: 'OPEN',
        windowClosesAt: { lte: now },
      },
    });

    for (const s of toClose) {
      try {
        await closeWindow(s.id);
        emitSessionClosed(s.subjectId, s.id);
        logger.info({ sessionId: s.id }, 'Reconciler: closed window');
      } catch (err) {
        logger.error({ err, sessionId: s.id }, 'Reconciler: failed to close window');
      }
    }

    // 3. Finalize sessions that should be finalized (OPEN or CLOSED and class has ended)
    const toFinalize = await prisma.classSession.findMany({
      where: {
        status: { in: ['OPEN', 'CLOSED'] },
        endsAt: { lte: now },
      },
    });

    for (const s of toFinalize) {
      try {
        // If still OPEN, close first
        if (s.status === 'OPEN') {
          await closeWindow(s.id);
          emitSessionClosed(s.subjectId, s.id);
        }
        await finalizeSession(s.id);
        await emitSessionFinalized(s.subjectId, s.id);
        logger.info({ sessionId: s.id }, 'Reconciler: finalized session');
      } catch (err) {
        logger.error({ err, sessionId: s.id }, 'Reconciler: failed to finalize session');
      }
    }

    if (toOpen.length || toClose.length || toFinalize.length) {
      logger.info(
        { opened: toOpen.length, closed: toClose.length, finalized: toFinalize.length },
        'Reconciler run complete'
      );
    }
  } catch (err) {
    logger.error({ err }, 'Reconciler failed');
  }
}

// Start the reconciler interval (every 60 seconds)
let intervalId: NodeJS.Timeout | null = null;

export function startReconciler() {
  if (intervalId) return;
  logger.info('Starting reconciler (every 60s)');
  intervalId = setInterval(reconcile, 60_000);
  // Also run immediately
  reconcile();
}

export function stopReconciler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
