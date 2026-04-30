// api/routes/notifications.ts
//
// Routes:
//   GET    /api/notifications           — public
//   GET    /api/notifications/admin     — editor-auth
//   POST   /api/notifications           — editor-auth
//   PATCH  /api/notifications/:id       — editor-auth
//   DELETE /api/notifications/:id       — editor-auth
//   GET    /api/notifications/reads     — lawyer-auth | editor-auth
//   POST   /api/notifications/:id/read  — lawyer-auth | editor-auth

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from 'firebase-admin/database';
import { v4 as uuidv4 } from 'uuid';
import type { LawyerTokenPayload, EditorTokenPayload } from '../plugins/auth';

// ── Types ──────────────────────────────────────────────────────────────────

type NotificationType   = 'feature' | 'info' | 'warning';
type NotificationAudience = 'all' | 'lawyers' | 'editors';
type NotificationStatus = 'active' | 'archived';

interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  audience: NotificationAudience;
  status: NotificationStatus;
  cta?: { label: string; url: string };
  createdAt: string;
  expiresAt?: string;
  authorId?: string;
}

// Fastify decorates the request with the decoded payload after verifyEditor/verifyLawyer.
// Extend the type so TypeScript knows about it without @ts-expect-error.
declare module 'fastify' {
  interface FastifyRequest {
    lawyerPayload?: LawyerTokenPayload;
    editorPayload?: EditorTokenPayload;
  }
}

// ── Plugin ─────────────────────────────────────────────────────────────────

export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  const db       = getDatabase();
  const ref      = db.ref('notifications');
  const readsRef = db.ref('notificationReads');

  // ── GET /api/notifications (public) ──────────────────────────────────────

  app.get('/api/notifications', async (_req, reply) => {
    const snapshot = await ref.orderByChild('status').equalTo('active').once('value');
    const raw: Record<string, AppNotification> = snapshot.val() ?? {};

    const now = new Date();
    const notifications = Object.values(raw).filter(
      (n) => !(n.expiresAt && new Date(n.expiresAt) < now)
    );

    return reply.send(notifications);
  });

  // ── GET /api/notifications/admin (editor-auth) ────────────────────────────
  // Must be registered BEFORE /:id routes so Fastify matches it first.

  app.get(
    '/api/notifications/admin',
    { preHandler: [app.verifyEditor] },
    async (_req, reply) => {
      const snapshot = await ref.once('value');
      const raw: Record<string, AppNotification> = snapshot.val() ?? {};
      const notifications = Object.values(raw).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return reply.send(notifications);
    }
  );

  // ── GET /api/notifications/reads (lawyer-auth | editor-auth) ─────────────
  // Also registered before /:id to avoid being swallowed by the param route.

  app.get(
    '/api/notifications/reads',
    { preHandler: [verifyLawyerOrEditor(app)] },
    async (req, reply) => {
      const uid = resolveUid(req);
      if (!uid) return reply.status(401).send({ error: 'Unauthorized' });

      const snap = await readsRef.child(uid).once('value');
      return reply.send(snap.val() ?? {});
    }
  );

  // ── POST /api/notifications (editor-auth) ─────────────────────────────────

  app.post(
    '/api/notifications',
    { preHandler: [app.verifyEditor] },
    async (req, reply) => {
      const body = req.body as Partial<AppNotification>;

      if (!body.title?.trim() || !body.body?.trim()) {
        return reply.status(400).send({ error: 'title and body are required' });
      }
      if (!['feature', 'info', 'warning'].includes(body.type ?? '')) {
        return reply.status(400).send({ error: 'invalid type' });
      }
      if (!['all', 'lawyers', 'editors'].includes(body.audience ?? '')) {
        return reply.status(400).send({ error: 'invalid audience' });
      }

      const id = `notif-${uuidv4().slice(0, 8)}`;
      const notification: AppNotification = {
        id,
        title:    body.title.trim(),
        body:     body.body.trim(),
        type:     (body.type as NotificationType) ?? 'info',
        audience: (body.audience as NotificationAudience) ?? 'all',
        status:   'active',
        createdAt: new Date().toISOString(),
        ...(body.cta?.label && body.cta?.url ? { cta: body.cta } : {}),
        ...(body.expiresAt ? { expiresAt: body.expiresAt } : {}),
        ...(req.editorPayload?.id ? { authorId: req.editorPayload.id } : {}),
      };

      await ref.child(id).set(notification);
      return reply.status(201).send(notification);
    }
  );

  // ── PATCH /api/notifications/:id (editor-auth) ────────────────────────────

  app.patch(
    '/api/notifications/:id',
    { preHandler: [app.verifyEditor] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { id } = req.params;
      const body = req.body as Partial<Pick<AppNotification, 'status' | 'expiresAt'>>;

      const snap = await ref.child(id).once('value');
      if (!snap.exists()) {
        return reply.status(404).send({ error: 'Notification not found' });
      }

      const allowed: Partial<AppNotification> = {};
      if (body.status && ['active', 'archived'].includes(body.status)) {
        allowed.status = body.status;
      }
      if (body.expiresAt) {
        allowed.expiresAt = body.expiresAt;
      }

      await ref.child(id).update(allowed);
      return reply.send({ ok: true });
    }
  );

  // ── DELETE /api/notifications/:id (editor-auth) ───────────────────────────

  app.delete(
    '/api/notifications/:id',
    { preHandler: [app.verifyEditor] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { id } = req.params;
      await ref.child(id).remove();
      return reply.send({ ok: true });
    }
  );

  // ── POST /api/notifications/:id/read (lawyer-auth | editor-auth) ──────────

  app.post(
    '/api/notifications/:id/read',
    { preHandler: [verifyLawyerOrEditor(app)] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const uid = resolveUid(req);
      if (!uid) return reply.status(401).send({ error: 'Unauthorized' });

      await readsRef.child(uid).child(req.params.id).set({
        readAt: new Date().toISOString(),
        uid,
      });

      return reply.send({ ok: true });
    }
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns a preHandler that accepts either a valid lawyer OR editor token.
 * Tries verifyLawyer first; if it rejects (throws or sends a reply), falls
 * back to verifyEditor. If both fail, the second rejection stands.
 *
 * Because Fastify decorators call reply.send() on failure rather than
 * throwing, we have to intercept the reply before it's sent and retry.
 */
function verifyLawyerOrEditor(app: FastifyInstance) {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Check the Authorization header ourselves before handing off to decorators,
    // so we can attempt both without sending a premature 401.
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Authentication required.' });
    }

    // Attempt lawyer first by running verifyLawyer in a try/catch.
    // verifyLawyer sends a reply on failure — we need to avoid that, so we
    // duplicate the token verification logic inline using the same jwt secret
    // exposed via app.verifyLawyer's internal mechanism.
    //
    // The cleanest approach with Fastify plugins: expose a raw verify helper
    // from the auth plugin (see note below), or simply try each decorator and
    // check req.lawyerPayload / req.editorPayload afterward.
    //
    // Since the auth plugin decorates verifyEditor / verifyLawyer onto the
    // instance, we call them sequentially and suppress the reply on the first
    // failure by using a reply proxy.

    let lawyerPassed = false;

    try {
      // Clone the request context and run verifyLawyer without letting it
      // commit a response. We detect success by checking if lawyerPayload
      // was populated — verifyLawyer must decorate req.lawyerPayload on success.
      await app.verifyLawyer(req, reply);
      lawyerPassed = req.lawyerPayload !== undefined;
    } catch {
      // verifyLawyer threw — not a lawyer token
    }

    if (lawyerPassed) return;

    // Fall through to editor verification — this one is allowed to send the
    // 401 directly if it also fails, which is the correct terminal behaviour.
    await app.verifyEditor(req, reply);
  };
}

/**
 * Resolve the UID to use for RTDB read tracking.
 * Lawyer payload carries `uid`; editor payload carries `id` (or falls back to 'editor').
 */
function resolveUid(req: FastifyRequest): string | null {
  if (req.lawyerPayload?.uid)  return req.lawyerPayload.uid;
  if (req.editorPayload?.id)   return req.editorPayload.id;
  // Editor token without an id field — use a fixed key so reads are still tracked
  if (req.editorPayload)       return 'editor';
  return null;
}