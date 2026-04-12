/**
 * plugins/auth.ts
 *
 * Registers two Fastify decorators:
 *   fastify.verifyEditor()    requires a valid editor JWT (secretary)
 *   fastify.verifyLawyer()    requires a valid lawyer JWT
 *
 * Use as a preHandler on any route that needs protection:
 *   { preHandler: [fastify.verifyEditor] }
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface EditorTokenPayload {
  role: 'editor';
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

function extractBearer(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.auth.jwtSecret) as TokenPayload;
}

async function authPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorate('verifyEditor', async function verifyEditor(req: FastifyRequest, reply: FastifyReply) {
    const token = extractBearer(req);
    if (!token) {
      return reply.status(401).send({ error: 'Authentication required.' });
    }
    try {
      const payload = verifyToken(token);
      if (payload.role !== 'editor') {
        return reply.status(403).send({ error: 'Editor access required.' });
      }
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token.' });
    }
  });

  fastify.decorate('verifyLawyer', async function verifyLawyer(req: FastifyRequest, reply: FastifyReply) {
    const token = extractBearer(req);
    if (!token) {
      return reply.status(401).send({ error: 'Authentication required.' });
    }
    try {
      const payload = verifyToken(token);
      if (payload.role !== 'lawyer') {
        return reply.status(403).send({ error: 'Lawyer access required.' });
      }
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token.' });
    }
  });
}

export default fp(authPlugin, { name: 'auth' });

//     Token factory (used by route handlers)

export function signEditorToken(): string {
  return jwt.sign({ role: 'editor' } as Omit<EditorTokenPayload, 'iat' | 'exp'>, config.auth.jwtSecret, {
    expiresIn: config.auth.editorTokenExpiry,
  } as jwt.SignOptions);
}

export function signLawyerToken(uid: string, email?: string): string {
  return jwt.sign({ role: 'lawyer', uid, email } as Omit<LawyerTokenPayload, 'iat' | 'exp'>, config.auth.jwtSecret, {
    expiresIn: config.auth.lawyerTokenExpiry,
  } as jwt.SignOptions);
}
