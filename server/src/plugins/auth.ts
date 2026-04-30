// api/plugins/auth.ts
//
// Changes vs previous version:
//   - verifyLawyer now decorates req.lawyerPayload on success
//   - verifyEditor  now decorates req.editorPayload on success
//   - LawyerTokenPayload and EditorTokenPayload are exported for use in routes
//   - signEditorToken / signLawyerToken remain unchanged

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { sign, verify } from 'jsonwebtoken';
import { config } from '../config';

// ── Payload types (imported by routes/notifications.ts) ───────────────────

export interface EditorTokenPayload {
  role: 'editor';
  id?: string;
  iat: number;
  exp: number;
}

export interface LawyerTokenPayload {
  role: 'lawyer';
  uid: string;
  email?: string;
  iat: number;
  exp: number;
}

type TokenPayload = EditorTokenPayload | LawyerTokenPayload;

// ── Fastify type augmentation ─────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    verifyEditor(req: FastifyRequest, reply: FastifyReply): Promise<void>;
    verifyLawyer(req: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
  interface FastifyRequest {
    lawyerPayload?: LawyerTokenPayload;
    editorPayload?: EditorTokenPayload;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function extractBearer(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

function verifyToken(token: string): TokenPayload {
  return verify(token, config.auth.jwtSecret) as TokenPayload;
}

// ── Token signers (called from auth routes) ───────────────────────────────

export function signEditorToken(id?: string): string {
  const payload: Omit<EditorTokenPayload, 'iat' | 'exp'> = {
    role: 'editor',
    ...(id ? { id } : {}),
  };
  return sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.editorTokenExpiry ?? '4h',
  });
}

export function signLawyerToken(uid: string, email?: string): string {
  const payload: Omit<LawyerTokenPayload, 'iat' | 'exp'> = {
    role: 'lawyer',
    uid,
    ...(email ? { email } : {}),
  };
  return sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.lawyerTokenExpiry ?? '8h',
  });
}

// ── Plugin ────────────────────────────────────────────────────────────────

async function authPlugin(fastify: FastifyInstance): Promise<void> {

  fastify.decorate(
    'verifyEditor',
    async function verifyEditor(req: FastifyRequest, reply: FastifyReply): Promise<void> {
      const token = extractBearer(req);
      if (!token) {
        return reply.status(401).send({ error: 'Authentication required.' });
      }
      try {
        const payload = verifyToken(token);
        if (payload.role !== 'editor') {
          return reply.status(403).send({ error: 'Editor access required.' });
        }
        // Decorate the request so downstream handlers can read the payload
        req.editorPayload = payload as EditorTokenPayload;
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired token.' });
      }
    }
  );

  fastify.decorate(
    'verifyLawyer',
    async function verifyLawyer(req: FastifyRequest, reply: FastifyReply): Promise<void> {
      const token = extractBearer(req);
      if (!token) {
        return reply.status(401).send({ error: 'Authentication required.' });
      }
      try {
        const payload = verifyToken(token);
        if (payload.role !== 'lawyer') {
          return reply.status(403).send({ error: 'Lawyer access required.' });
        }
        // Decorate the request so downstream handlers and verifyLawyerOrEditor can read it
        req.lawyerPayload = payload as LawyerTokenPayload;
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired token.' });
      }
    }
  );
}

export default fp(authPlugin, { name: 'auth' });