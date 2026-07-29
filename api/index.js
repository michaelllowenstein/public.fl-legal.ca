"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/vercel-entry.ts
var vercel_entry_exports = {};
__export(vercel_entry_exports, {
  default: () => handler
});
module.exports = __toCommonJS(vercel_entry_exports);
var import_fastify = __toESM(require("fastify"));
var import_cors = __toESM(require("@fastify/cors"));
var import_helmet = __toESM(require("@fastify/helmet"));
var import_rate_limit = __toESM(require("@fastify/rate-limit"));

// src/config/index.ts
var dotenv = __toESM(require("dotenv"));
dotenv.config();
dotenv.config({ path: "../../resend.env", override: true });
var need = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
};
function optional(name, fallback = "") {
  return process.env[name] ?? fallback;
}
var nodeEnv = optional("NODE_ENV", "development");
var isDev = nodeEnv === "development";
var isStage = nodeEnv === "staging";
var isProd = nodeEnv === "production";
var maxDuration = 15;
var defaultOrigins = isDev ? "https://localhost:4422" : isStage ? "https://staging.fl-legal.ca" : "https://fl-legal.ca";
var defaultCert = isDev ? "cert/local/localhost.crt" : isStage ? "cert/stage/staging.cert" : "";
var defaultKey = isDev ? "cert/local/localhost.decrypted.key" : isStage ? "cert/stage/staging.key" : "";
var config2 = {
  port: parseInt(optional("PORT", "3000"), 10),
  host: optional("HOSTNAME", "0.0.0.0"),
  maxDuration,
  nodeEnv,
  isDev,
  isStage,
  isProd,
  // ── TLS ───────────────────────────────────────────────────────────────────
  // Set HTTPS=false to run plain HTTP (e.g. behind a TLS-terminating proxy).
  // SSLCHAIN and SSLPFX are optional — soft-fail if absent (mirrors tryLoad).
  https: {
    enabled: optional("HTTPS", "true") === "true",
    certFile: optional("TLS_CERT", defaultCert),
    keyFile: optional("TLS_KEY", defaultKey),
    chainFile: optional("SSLCHAIN"),
    // optional CA chain
    pfxFile: optional("SSLPFX")
    // optional PFX bundle
  },
  // ── CORS ──────────────────────────────────────────────────────────────────
  cors: {
    allowedOrigins: optional("ALLOWED_ORIGINS", defaultOrigins).split(",").map((o) => o.trim()).filter(Boolean)
  },
  auth: {
    jwtSecret: need("JWT_SECRET"),
    calcPasswordHash: need("CALC_HASH"),
    editorPasswordHash: need("EDITOR_HASH"),
    adminPasswordHash: need("ADMIN_HASH"),
    lawyerTokenExpiry: optional("LAWYER_TOKEN_EXPIRY", "8h"),
    editorTokenExpiry: optional("EDITOR_TOKEN_EXPIRY", "4h"),
    calcTokenExpiry: optional("EDITOR_TOKEN_EXPIRY", "4h")
  },
  firebase: {
    // ── Credential priority (first match wins) ──────────────────────────────
    //   1. FIREBASE_SERVICE_ACCOUNT_JSON — base64-encoded full service account
    //      JSON blob. Most reliable on Vercel: no newline handling edge cases.
    //      Generate: base64 -i friclowenstein-firebase-adminsdk.json | tr -d '\n'
    //      Set that output as the FIREBASE_SERVICE_ACCOUNT_JSON env var on Vercel.
    //   2. FIREBASE_SERVICE_ACCOUNT_PATH — path to a local JSON file (local dev).
    //   3. Three inline vars (projectId, clientEmail, privateKey) — fallback.
    serviceAccountJson: optional("FIREBASE_SERVICE_ACCOUNT_JSON"),
    serviceAccountPath: optional("FIREBASE_SERVICE_ACCOUNT_PATH"),
    projectId: optional("FIREBASE_PROJECT_ID"),
    clientEmail: optional("FIREBASE_CLIENT_EMAIL"),
    privateKey: optional("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    databaseUrl: need("FIREBASE_DATABASE_URL")
  },
  email: {
    apiKey: need("RESEND_API_KEY"),
    fromEmail: optional("EMAIL_FROM", "no-reply@fl-legal.ca"),
    fromName: optional("EMAIL_FROM_NAME", "Fric, Lowenstein & Co. LLP"),
    firmEmail: need("FIRM_EMAIL"),
    replyTo: optional("EMAIL_REPLY_TO", "friclow@gmail.com"),
    testRecipient: optional("TEST_EMAIL_RECIPIENT")
  }
  /**
   * ── .env additions (per environment) ──────────────────────────────────────
   *
   * Production (Vercel → fl-legal.ca):
   *   SENDGRID_API_KEY=SG.prod_key_here
   *   EMAIL_FROM=no-reply@fl-legal.ca
   *   FIRM_EMAIL=friclow@gmail.com
   *   EMAIL_SANDBOX=false
   *
   * Staging (Vercel → staging.fl-legal.ca):
   *   SENDGRID_API_KEY=SG.staging_key_here
   *   EMAIL_FROM=no-reply@fl-legal.ca
   *   FIRM_EMAIL=friclow@gmail.com
   *   EMAIL_SANDBOX=false
   *   TEST_EMAIL_RECIPIENT=michaelllowenstein@gmail.com
   *
   * Local dev (server/.env):
   *   SENDGRID_API_KEY=SG.dev_key_here
   *   EMAIL_FROM=no-reply@fl-legal.ca
   *   FIRM_EMAIL=friclow@gmail.com
   *   EMAIL_SANDBOX=true
   *   TEST_EMAIL_RECIPIENT=michaelllowenstein@gmail.com
   *
   * ── Remove these env vars (no longer used) ────────────────────────────────
   *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
   *   SENDGRID_API_KEY (the old process.env direct read) — now goes through
   *   config.email.apiKey via the require() helper.
   */
};

// src/plugins/auth.ts
var import_fastify_plugin = __toESM(require("fastify-plugin"));
var import_jsonwebtoken = require("jsonwebtoken");
function extractBearer(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}
function verifyToken(token) {
  return (0, import_jsonwebtoken.verify)(token, config2.auth.jwtSecret);
}
function tokenExpiry(value) {
  return value;
}
function signEditorToken(id) {
  const payload = {
    role: "editor",
    ...id ? { id } : {}
  };
  return (0, import_jsonwebtoken.sign)(payload, config2.auth.jwtSecret, {
    expiresIn: tokenExpiry(config2.auth.editorTokenExpiry ?? "4h")
  });
}
function signCalcToken(id) {
  const payload = {
    role: "calc",
    ...id ? { id } : {}
  };
  return (0, import_jsonwebtoken.sign)(payload, config2.auth.jwtSecret, {
    expiresIn: tokenExpiry(config2.auth.calcTokenExpiry ?? "4h")
  });
}
function signLawyerToken(uid, email) {
  const payload = {
    role: "lawyer",
    uid,
    ...email ? { email } : {}
  };
  return (0, import_jsonwebtoken.sign)(payload, config2.auth.jwtSecret, {
    expiresIn: tokenExpiry(config2.auth.lawyerTokenExpiry ?? "8h")
  });
}
async function authPlugin(fastify) {
  fastify.decorate(
    "verifyCalcConfig",
    async function verifyCalcConfig(req, reply) {
      const token = extractBearer(req);
      if (!token) {
        return reply.status(401).send({ error: "Authentication required." });
      }
      try {
        const payload = verifyToken(token);
        if (payload.role !== "calc") {
          return reply.status(403).send({ error: "Calculator config access required." });
        }
        req.calcPayload = payload;
      } catch {
        return reply.status(401).send({ error: "Invalid or expired token." });
      }
    }
  );
  fastify.decorate(
    "verifyEditor",
    async function verifyEditor(req, reply) {
      const token = extractBearer(req);
      if (!token) {
        return reply.status(401).send({ error: "Authentication required." });
      }
      try {
        const payload = verifyToken(token);
        if (payload.role !== "editor") {
          return reply.status(403).send({ error: "Editor access required." });
        }
        req.editorPayload = payload;
      } catch {
        return reply.status(401).send({ error: "Invalid or expired token." });
      }
    }
  );
  fastify.decorate(
    "verifyLawyer",
    async function verifyLawyer(req, reply) {
      const token = extractBearer(req);
      if (!token) {
        return reply.status(401).send({ error: "Authentication required." });
      }
      try {
        const payload = verifyToken(token);
        if (payload.role !== "lawyer") {
          return reply.status(403).send({ error: "Lawyer access required." });
        }
        req.lawyerPayload = payload;
      } catch {
        return reply.status(401).send({ error: "Invalid or expired token." });
      }
    }
  );
}
var auth_default = (0, import_fastify_plugin.default)(authPlugin, { name: "auth" });

// src/routes/auth.ts
var import_bcrypt = __toESM(require("bcrypt"));
var admin = __toESM(require("firebase-admin"));

// src/schema/editor-login.ts
var editorLoginSchema = {
  body: {
    type: "object",
    required: ["password"],
    additionalProperties: false,
    properties: {
      password: { type: "string", minLength: 1, maxLength: 256 }
    }
  }
};

// src/schema/inquiry.ts
var generalInquirySchema = {
  body: {
    type: "object",
    required: ["name", "email", "message"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      email: { type: "string", format: "email", maxLength: 254 },
      phone: { type: "string", maxLength: 30 },
      message: { type: "string", minLength: 1, maxLength: 2e3 }
    }
  }
};
var priorityInquirySchema = {
  body: {
    type: "object",
    required: ["name", "email", "message"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      email: { type: "string", format: "email", maxLength: 254 },
      phone: { type: "string", maxLength: 30 },
      message: { type: "string", minLength: 1, maxLength: 2e3 },
      practiceArea: { type: "string", maxLength: 80 }
    }
  }
};

// src/schema/lawyer-login.ts
var fricLowensteinLoginSchema = {
  body: {
    type: "object",
    required: ["username", "password"],
    additionalProperties: false,
    properties: {
      username: { type: "string", minLength: 1, maxLength: 80 },
      password: { type: "string", minLength: 1, maxLength: 256 }
    }
  }
};

// src/schema/calc-login.ts
var calcLoginSchema = {
  body: {
    type: "object",
    required: ["password"],
    additionalProperties: false,
    properties: {
      password: { type: "string", minLength: 1, maxLength: 256 }
    }
  }
};

// src/routes/auth.ts
async function authRoutes(fastify) {
  fastify.post(
    "/editor",
    {
      schema: editorLoginSchema,
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } }
    },
    async (req, reply) => {
      const match = await import_bcrypt.default.compare(
        req.body.password,
        config2.auth.editorPasswordHash
      );
      if (!match) {
        return reply.status(401).send({ error: "Invalid credentials." });
      }
      const token = signEditorToken();
      return reply.status(200).send({ token });
    }
  );
  fastify.post(
    "/calc",
    {
      schema: calcLoginSchema,
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } }
    },
    async (req, reply) => {
      if (!config2.auth.calcPasswordHash) {
        req.log.error("Calculator config password hash is not configured");
        return reply.status(500).send({ error: "Calculator config login is not configured." });
      }
      const match = await import_bcrypt.default.compare(
        req.body.password,
        config2.auth.calcPasswordHash
      );
      if (!match) {
        return reply.status(401).send({ error: "Invalid credentials." });
      }
      const token = signCalcToken();
      return reply.status(200).send({ token });
    }
  );
  fastify.post(
    "/lawyer",
    {
      schema: {
        body: {
          type: "object",
          required: ["idToken"],
          additionalProperties: false,
          properties: { idToken: { type: "string", minLength: 1 } }
        }
      },
      config: { rateLimit: { max: 20, timeWindow: "5 minutes" } }
    },
    async (req, reply) => {
      try {
        const decoded = await admin.auth().verifyIdToken(req.body.idToken);
        const token = signLawyerToken(decoded.uid, decoded.email);
        return reply.status(200).send({ token });
      } catch (err) {
        req.log.warn({ err }, "Lawyer ID token verification failed");
        return reply.status(401).send({ error: "Invalid or expired Firebase token." });
      }
    }
  );
  fastify.post(
    "/lawyer/password",
    {
      schema: fricLowensteinLoginSchema,
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } }
    },
    async (req, reply) => {
      const { username, password } = req.body;
      try {
        const snap = await admin.database().ref(`/lawyers/${username}`).once("value");
        if (!snap.exists()) {
          return reply.status(401).send({ error: "Invalid credentials." });
        }
        const record = snap.val();
        const match = await import_bcrypt.default.compare(password, record.passwordHash);
        if (!match) {
          return reply.status(401).send({ error: "Invalid credentials." });
        }
        const token = signLawyerToken(record.uid, record.email);
        return reply.status(200).send({ token });
      } catch (err) {
        req.log.error({ err }, "Lawyer password login error");
        return reply.status(500).send({ error: "Login failed. Please try again." });
      }
    }
  );
}

// src/services/firebase.ts
var import_firebase_admin = __toESM(require("firebase-admin"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var DB_ROOT = "public";
function normalized(logicalPath) {
  return `${DB_ROOT}/${logicalPath.replace(/^\/+/, "")}`;
}
function initFirebase() {
  if (import_firebase_admin.default.apps.length > 0) return;
  let credential;
  if (config2.firebase.serviceAccountJson) {
    try {
      const json = Buffer.from(config2.firebase.serviceAccountJson, "base64").toString("utf8");
      const serviceAccount = JSON.parse(json);
      credential = import_firebase_admin.default.credential.cert(serviceAccount);
      console.log("\u2713 Firebase Admin: using base64 service account JSON");
    } catch (err) {
      throw new Error(
        `Failed to decode FIREBASE_SERVICE_ACCOUNT_JSON. Ensure it is a valid base64-encoded service account JSON file.
${err}`
      );
    }
  } else if (config2.firebase.serviceAccountPath) {
    const resolved = path.resolve(config2.firebase.serviceAccountPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(
        `Firebase service account file not found: ${resolved}
Set FIREBASE_SERVICE_ACCOUNT_PATH in .env or provide inline env vars.`
      );
    }
    const serviceAccount = JSON.parse(fs.readFileSync(resolved, "utf8"));
    credential = import_firebase_admin.default.credential.cert(serviceAccount);
    console.log("\u2713 Firebase Admin: using service account JSON file");
  } else if (config2.firebase.projectId && config2.firebase.clientEmail && config2.firebase.privateKey) {
    credential = import_firebase_admin.default.credential.cert({
      projectId: config2.firebase.projectId,
      clientEmail: config2.firebase.clientEmail,
      privateKey: config2.firebase.privateKey
    });
    console.log("\u2713 Firebase Admin: using inline env vars (projectId/clientEmail/privateKey)");
  } else {
    throw new Error(
      "Firebase credentials not configured. Provide one of:\n  \u2022 FIREBASE_SERVICE_ACCOUNT_JSON (base64-encoded JSON \u2014 recommended for Vercel)\n  \u2022 FIREBASE_SERVICE_ACCOUNT_PATH (path to JSON file \u2014 for local dev)\n  \u2022 FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY"
    );
  }
  import_firebase_admin.default.initializeApp({
    credential,
    databaseURL: config2.firebase.databaseUrl
  });
}
var _db = null;
function db() {
  if (!_db) _db = import_firebase_admin.default.database();
  return _db;
}
async function dbGet(logicalPath) {
  const snap = await db().ref(normalized(logicalPath)).once("value");
  return snap.exists() ? snap.val() : null;
}
async function dbUpdate(logicalPath, value) {
  await db().ref(normalized(logicalPath)).update(value);
}
async function dbPush(logicalPath, value) {
  const ref = await db().ref(normalized(logicalPath)).push(value);
  return ref.key;
}
async function dbRemove(logicalPath) {
  await db().ref(normalized(logicalPath)).remove();
}
async function dbMultiUpdate(updates) {
  await db().ref("/").update(updates);
}

// src/routes/content.ts
var ROOT = "siteContent";
var VALID_SECTIONS = /* @__PURE__ */ new Set(["home", "aboutUs", "areasOfLaw", "pricing", "faq"]);
async function contentRoutes(fastify) {
  fastify.get(
    "/",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (req, reply) => {
      try {
        const data = await dbGet(ROOT);
        reply.header("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
        return reply.status(200).send(data ?? {});
      } catch (err) {
        req.log.error({ err }, "Failed to fetch site content");
        return reply.status(500).send({ error: "Could not load content." });
      }
    }
  );
  fastify.get(
    "/:section",
    {
      schema: {
        params: {
          type: "object",
          required: ["section"],
          properties: { section: { type: "string", maxLength: 80 } }
        }
      },
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } }
    },
    async (req, reply) => {
      const { section } = req.params;
      if (!VALID_SECTIONS.has(section)) {
        return reply.status(404).send({
          error: `Unknown section '${section}'. Valid: ${[...VALID_SECTIONS].join(", ")}`
        });
      }
      try {
        const data = await dbGet(`${ROOT}/${section}`);
        if (data === null) {
          return reply.status(404).send({ error: `Section '${section}' not found.` });
        }
        reply.header("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
        return reply.status(200).send(data);
      } catch (err) {
        req.log.error({ err }, "Failed to fetch content section", { section });
        return reply.status(500).send({ error: "Could not load content." });
      }
    }
  );
  fastify.patch(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["key", "value"],
          additionalProperties: false,
          properties: {
            key: { type: "string", minLength: 1, maxLength: 500 },
            value: { type: "string", maxLength: 2e5 }
          }
        }
      },
      preHandler: [fastify.verifyEditor],
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } }
    },
    async (req, reply) => {
      const { key, value } = req.body;
      const safePath = key.replace(/\.\./g, "").replace(/^\/+/, "").trim();
      if (!safePath) {
        return reply.status(400).send({ error: "Invalid content key." });
      }
      const topSection = safePath.split("/")[0];
      if (!VALID_SECTIONS.has(topSection)) {
        return reply.status(400).send({
          error: `Invalid section '${topSection}'. Must start with one of: ${[...VALID_SECTIONS].join(", ")}`
        });
      }
      try {
        const auditKey = `audit/content/${Date.now()}`;
        await dbMultiUpdate({
          [`public/${ROOT}/${safePath}`]: value,
          [`public/${auditKey}`]: {
            key: safePath,
            value: value.length > 200 ? value.slice(0, 200) + "\u2026" : value,
            at: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
        req.log.info({ key: safePath }, "Content field updated");
        return reply.status(204).send();
      } catch (err) {
        req.log.error({ err, key: safePath }, "Failed to update content");
        return reply.status(500).send({ error: "Could not save content." });
      }
    }
  );
}

// src/routes/blog.ts
var ROOT2 = "blog";
var postBodySchema = {
  type: "object",
  required: ["title", "date", "content"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 300 },
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    author: { type: "string", maxLength: 100 },
    category: { type: "string", maxLength: 100 },
    excerpt: { type: "string", maxLength: 1e3 },
    content: { type: "string", minLength: 1, maxLength: 5e5 },
    imageUrl: { type: "string", maxLength: 512 }
  }
};
async function blogRoutes(fastify) {
  const editorGuard = [fastify.verifyEditor];
  fastify.get(
    "/",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (req, reply) => {
      try {
        const raw = await dbGet(ROOT2);
        if (!raw) return reply.status(200).send([]);
        const posts = Object.entries(raw).map(([id, post]) => ({
          ...post,
          id,
          // Omit full content from list view for faster responses
          content: void 0
        })).filter((p) => p.title).sort((a, b) => b.date.localeCompare(a.date));
        reply.header("Cache-Control", "public, max-age=30");
        return reply.status(200).send(posts);
      } catch (err) {
        req.log.error({ err }, "Failed to fetch blog posts");
        return reply.status(500).send({ error: "Could not load blog." });
      }
    }
  );
  fastify.get(
    "/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", maxLength: 100 } }
        }
      },
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } }
    },
    async (req, reply) => {
      const { id } = req.params;
      try {
        const post = await dbGet(`${ROOT2}/${id}`);
        if (!post || !post.title) {
          return reply.status(404).send({ error: "Post not found." });
        }
        reply.header("Cache-Control", "public, max-age=30");
        return reply.status(200).send({ ...post, id });
      } catch (err) {
        req.log.error({ err, id }, "Failed to fetch blog post");
        return reply.status(500).send({ error: "Could not load post." });
      }
    }
  );
  fastify.post(
    "/",
    {
      schema: { body: postBodySchema },
      preHandler: editorGuard,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
    },
    async (req, reply) => {
      try {
        const post = {
          ...req.body,
          category: req.body.category ?? "General",
          author: req.body.author ?? "Fric, Lowenstein & Co. LLP",
          excerpt: req.body.excerpt ?? "",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        const id = await dbPush(ROOT2, post);
        req.log.info({ id }, "Blog post created");
        return reply.status(201).send({ id, ...post });
      } catch (err) {
        req.log.error({ err }, "Failed to create blog post");
        return reply.status(500).send({ error: "Could not create post." });
      }
    }
  );
  fastify.patch(
    "/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", maxLength: 100 } }
        },
        body: { ...postBodySchema, required: [] }
      },
      preHandler: editorGuard,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
    },
    async (req, reply) => {
      const { id } = req.params;
      try {
        const existing = await dbGet(`${ROOT2}/${id}`);
        if (!existing || !existing.title) {
          return reply.status(404).send({ error: "Post not found." });
        }
        await dbUpdate(`${ROOT2}/${id}`, req.body);
        req.log.info({ id }, "Blog post updated");
        return reply.status(204).send();
      } catch (err) {
        req.log.error({ err, id }, "Failed to update blog post");
        return reply.status(500).send({ error: "Could not update post." });
      }
    }
  );
  fastify.delete(
    "/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", maxLength: 100 } }
        }
      },
      preHandler: editorGuard,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } }
    },
    async (req, reply) => {
      const { id } = req.params;
      try {
        const existing = await dbGet(`${ROOT2}/${id}`);
        if (!existing || !existing.title) {
          return reply.status(404).send({ error: "Post not found." });
        }
        await dbRemove(`${ROOT2}/${id}`);
        req.log.info({ id }, "Blog post deleted");
        return reply.status(204).send();
      } catch (err) {
        req.log.error({ err, id }, "Failed to delete blog post");
        return reply.status(500).send({ error: "Could not delete post." });
      }
    }
  );
}

// src/services/mailer.ts
var import_resend = require("resend");
var RESEND_KEY = config2.email.apiKey ?? "";
console.log("[mailer] \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
console.log("[mailer] Initialising Resend email service");
console.log("[mailer]   NODE_ENV:         ", config2.nodeEnv);
console.log("[mailer]   apiKey present:   ", !!RESEND_KEY);
console.log("[mailer]   apiKey prefix:    ", RESEND_KEY ? RESEND_KEY.slice(0, 6) + "..." : "(empty)");
console.log("[mailer]   apiKey length:    ", RESEND_KEY.length);
console.log("[mailer]   fromEmail:        ", config2.email.fromEmail);
console.log("[mailer]   fromName:         ", config2.email.fromName);
console.log("[mailer]   firmEmail:        ", config2.email.firmEmail);
console.log("[mailer]   replyTo:          ", config2.email.replyTo || "(not set)");
console.log("[mailer]   testRecipient:    ", config2.email.testRecipient || "(not set \u2014 real addresses)");
console.log("[mailer] \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
if (!RESEND_KEY) {
  console.error("[mailer] \u26A0 RESEND_API_KEY is empty \u2014 all sends will fail");
}
var resend = new import_resend.Resend(RESEND_KEY);
function baseHtml(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body  { margin:0; padding:0; background:#f5f0e8; font-family:'Georgia',serif; color:#0f2235; }
    .wrap { max-width:600px; margin:32px auto; background:#fff; border-radius:12px;
            overflow:hidden; box-shadow:0 4px 24px rgba(15,34,53,.12); }
    .hdr  { background:#1a3a5c; padding:28px 32px; }
    .hdr h1 { margin:0; color:#b8932a; font-size:20px; font-weight:600; letter-spacing:.03em; }
    .hdr p  { margin:4px 0 0; color:rgba(255,255,255,.5); font-size:11px;
              text-transform:uppercase; letter-spacing:.1em; font-family:sans-serif; }
    .body { padding:32px; }
    .body h2 { margin:0 0 16px; font-size:18px; color:#1a3a5c; }
    table.fields { width:100%; border-collapse:collapse; margin:16px 0; }
    table.fields td { padding:8px 12px; font-size:14px; vertical-align:top; }
    table.fields tr:nth-child(odd) td { background:#f5f0e8; border-radius:4px; }
    table.fields td.label { width:130px; font-family:sans-serif; font-size:11px;
                            text-transform:uppercase; letter-spacing:.08em; color:#888;
                            font-weight:600; padding-top:10px; }
    .msg  { background:#f5f0e8; border-left:4px solid #b8932a; padding:16px;
            border-radius:0 8px 8px 0; font-size:14px; line-height:1.7; margin:16px 0; }
    .ftr  { background:#0f2235; padding:18px 32px; text-align:center;
            font-family:sans-serif; font-size:11px; color:rgba(255,255,255,.35); }
    .badge { display:inline-block; background:#b8932a; color:#0f2235; font-family:sans-serif;
             font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.1em;
             padding:3px 10px; border-radius:999px; margin-bottom:12px; }
    .change-list { margin:12px 0; padding:0; list-style:none; }
    .change-list li { padding:6px 10px; font-size:13px; font-family:sans-serif; color:#374151;
                      border-left:3px solid #b8932a; margin-bottom:6px; background:#f5f0e8;
                      border-radius:0 6px 6px 0; }
    .mono { font-family:'Courier New',monospace; font-size:12px; color:#6b7280;
            background:#f5f0e8; padding:2px 6px; border-radius:4px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>Fric, Lowenstein &amp; Co. LLP</h1>
      <p>Barristers &amp; Solicitors \u2014 Calgary, Alberta</p>
    </div>
    <div class="body">${body}</div>
    <div class="ftr">&copy; ${(/* @__PURE__ */ new Date()).getFullYear()} Fric, Lowenstein &amp; Co. LLP. All rights reserved.</div>
  </div>
</body>
</html>`;
}
async function sendGeneralInquiry(data) {
  console.log("[mailer] sendGeneralInquiry called", { name: data.name, email: data.email });
  const subject = `Appointment Request \u2014 ${data.name}`;
  const html = baseHtml(`
    <h2>New Appointment Request</h2>
    <table class="fields">
      <tr><td class="label">Name</td><td>${esc(data.name)}</td></tr>
      <tr><td class="label">Email</td><td><a href="mailto:${esc(data.email)}">${esc(data.email)}</a></td></tr>
      ${data.phone ? `<tr><td class="label">Phone</td><td>${esc(data.phone)}</td></tr>` : ""}
    </table>
    <p style="font-family:sans-serif;font-size:12px;color:#888;margin:0 0 6px">Message:</p>
    <div class="msg">${esc(data.message).replace(/\n/g, "<br>")}</div>
  `);
  const text = `New Appointment Request

Name:    ${data.name}
Email:   ${data.email}
` + (data.phone ? `Phone:   ${data.phone}
` : "") + `
Message:
${data.message}`;
  await send({ subject, html, text, replyTo: data.email });
  await sendClientConfirmation(data.name, data.email);
}
async function sendPriorityInquiry(data) {
  console.log("[mailer] sendPriorityInquiry called", {
    name: data.name,
    email: data.email,
    practiceArea: data.practiceArea ?? "(none)"
  });
  const areaLabel = data.practiceArea ? ` [${data.practiceArea}]` : "";
  const subject = `\u2605 PRIORITY INQUIRY${areaLabel} \u2014 ${data.name}`;
  const html = baseHtml(`
    <div class="badge">\u2605 Priority Inquiry${data.practiceArea ? " \u2014 " + esc(data.practiceArea) : ""}</div>
    <h2>Urgent Client Inquiry</h2>
    <p style="font-family:sans-serif;font-size:13px;color:#555;margin:0 0 16px">
      This inquiry has been marked <strong>priority</strong> and requires prompt attention.
    </p>
    <table class="fields">
      <tr><td class="label">Name</td><td>${esc(data.name)}</td></tr>
      <tr><td class="label">Email</td><td><a href="mailto:${esc(data.email)}">${esc(data.email)}</a></td></tr>
      ${data.phone ? `<tr><td class="label">Phone</td><td>${esc(data.phone)}</td></tr>` : ""}
      ${data.practiceArea ? `<tr><td class="label">Matter</td><td>${esc(data.practiceArea)}</td></tr>` : ""}
    </table>
    <p style="font-family:sans-serif;font-size:12px;color:#888;margin:0 0 6px">Message:</p>
    <div class="msg">${esc(data.message).replace(/\n/g, "<br>")}</div>
  `);
  const text = `\u2605 PRIORITY INQUIRY${areaLabel}

Name:    ${data.name}
Email:   ${data.email}
` + (data.phone ? `Phone:   ${data.phone}
` : "") + (data.practiceArea ? `Matter:  ${data.practiceArea}
` : "") + `
Message:
${data.message}`;
  await send({ subject, html, text, replyTo: data.email });
  await sendClientConfirmation(data.name, data.email);
}
async function sendClientConfirmation(name, toEmail) {
  console.log("[mailer] sendClientConfirmation called", { name, toEmail });
  const firstName = name.split(" ")[0];
  const subject = `We\u2019ve received your inquiry \u2014 Fric, Lowenstein & Co.`;
  const html = baseHtml(`
    <h2>Thank you, ${esc(firstName)}.</h2>
    <p style="font-size:15px;line-height:1.7">
      We have received your inquiry and a member of our team will be in touch
      with you within one business day.
    </p>
    <p style="font-size:15px;line-height:1.7">
      If your matter is urgent, please call us directly at
      <a href="tel:+14032912594" style="color:#1a3a5c">(403) 291-2594</a>.
    </p>
    <p style="font-size:13px;color:#888;margin-top:24px">
      Office hours: Monday \u2013 Friday, 8:30 AM \u2013 5:00 PM (Mountain Time)
    </p>
  `);
  const text = `Thank you, ${firstName}.

We have received your inquiry and will be in touch within one business day.

For urgent matters, call: (403) 291-2594
Office hours: Mon\u2013Fri, 8:30 AM \u2013 5:00 PM MT`;
  await send({ to: toEmail, subject, html, text });
}
async function send(opts) {
  const to = config2.email.testRecipient || opts.to || config2.email.firmEmail;
  const from = `${config2.email.fromName} <${config2.email.fromEmail}>`;
  const replyTo = opts.replyTo || config2.email.replyTo || void 0;
  console.log("[mailer:send] \u2500\u2500\u2500 Preparing email \u2500\u2500\u2500");
  console.log("[mailer:send]   from:      ", from);
  console.log("[mailer:send]   to:        ", to);
  console.log("[mailer:send]   subject:   ", opts.subject);
  console.log("[mailer:send]   replyTo:   ", replyTo ?? "(none)");
  console.log("[mailer:send]   html size: ", opts.html.length, "chars");
  console.log("[mailer:send]   text size: ", opts.text.length, "chars");
  console.log("[mailer:send]   apiKey ok: ", !!RESEND_KEY && RESEND_KEY.startsWith("re_"));
  console.log("[mailer:send]   recipient source:", config2.email.testRecipient ? "TEST_EMAIL_RECIPIENT" : opts.to ? "opts.to" : "FIRM_EMAIL");
  const payload = {
    from,
    to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    ...replyTo ? { reply_to: replyTo } : {}
  };
  const t0 = Date.now();
  try {
    console.log("[mailer:send]   Calling resend.emails.send()...");
    const result = await resend.emails.send(payload);
    const ms = Date.now() - t0;
    console.log("[mailer:send]   \u2500\u2500\u2500 Resend response \u2500\u2500\u2500");
    console.log("[mailer:send]   duration:  ", ms, "ms");
    console.log("[mailer:send]   data:      ", JSON.stringify(result.data));
    console.log("[mailer:send]   error:     ", JSON.stringify(result.error));
    if (result.error) {
      console.error("[mailer:send] \u274C Resend returned error:", JSON.stringify(result.error, null, 2));
      console.error("[mailer:send]   Error name:   ", result.error.name);
      console.error("[mailer:send]   Error message:", result.error.message);
      throw new Error(
        `Resend send failed [${result.error.name}]: ${result.error.message}`
      );
    }
    console.log("[mailer:send] \u2705 Email sent successfully");
    console.log("[mailer:send]   Resend ID: ", result.data?.id ?? "(no id returned)");
  } catch (err) {
    const ms = Date.now() - t0;
    if (err.message?.startsWith("Resend send failed")) {
      throw err;
    }
    console.error("[mailer:send] \u274C Unexpected error during send");
    console.error("[mailer:send]   duration:  ", ms, "ms");
    console.error("[mailer:send]   error type:", err?.constructor?.name ?? typeof err);
    console.error("[mailer:send]   message:   ", err?.message ?? String(err));
    console.error("[mailer:send]   stack:     ", err?.stack ?? "(no stack)");
    if (err?.statusCode) {
      console.error("[mailer:send]   statusCode:", err.statusCode);
    }
    if (err?.response) {
      console.error("[mailer:send]   response:  ", JSON.stringify(err.response));
    }
    throw new Error(
      `Email send failed: ${err?.message ?? String(err)}`
    );
  }
}
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// src/routes/inquiry.ts
async function inquiryRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: generalInquirySchema,
      config: { rateLimit: { max: 5, timeWindow: "10 minutes" } }
    },
    async (req, reply) => {
      try {
        await sendGeneralInquiry(req.body);
        return reply.status(204).send();
      } catch (err) {
        req.log.error({ err }, "Failed to send general inquiry email");
        return reply.status(502).send({ error: "Failed to send inquiry. Please try again." });
      }
    }
  );
  fastify.post(
    "/priority",
    {
      schema: priorityInquirySchema,
      config: { rateLimit: { max: 5, timeWindow: "10 minutes" } }
    },
    async (req, reply) => {
      try {
        await sendPriorityInquiry(req.body);
        return reply.status(204).send();
      } catch (err) {
        req.log.error({ err }, "Failed to send priority inquiry email");
        return reply.status(502).send({ error: "Failed to send inquiry. Please try again." });
      }
    }
  );
}

// src/routes/profile.ts
async function profileRoutes(fastify) {
  fastify.get(
    "/",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (req, reply) => {
      try {
        const [profilesMap, navMembers] = await Promise.all([
          dbGet("profiles"),
          dbGet("nav/members")
        ]);
        if (!profilesMap) return reply.status(200).send([]);
        let profiles = Object.values(profilesMap).filter((p) => p?.id);
        if (navMembers) {
          const orderMap = new Map(navMembers.map((m) => [m.value, m.order]));
          profiles.sort(
            (a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99)
          );
        }
        reply.header("Cache-Control", "public, max-age=60");
        return reply.status(200).send(profiles);
      } catch (err) {
        req.log.error({ err }, "Failed to fetch profiles");
        return reply.status(500).send({ error: "Could not load profiles." });
      }
    }
  );
  fastify.get(
    "/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", maxLength: 40 } }
        }
      },
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } }
    },
    async (req, reply) => {
      const { id } = req.params;
      try {
        const profile = await dbGet(`profiles/${id}`);
        if (!profile || !profile.id) {
          return reply.status(404).send({ error: `Profile '${id}' not found.` });
        }
        reply.header("Cache-Control", "public, max-age=60");
        return reply.status(200).send(profile);
      } catch (err) {
        req.log.error({ err, id }, "Failed to fetch profile");
        return reply.status(500).send({ error: "Could not load profile." });
      }
    }
  );
}

// src/routes/logs.ts
async function logRoutes(fastify) {
  fastify.post(
    "/client",
    {
      schema: {
        body: {
          type: "object",
          required: ["date", "entry"],
          additionalProperties: false,
          properties: {
            date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            entry: {
              type: "object",
              properties: {
                level: { type: "string", enum: ["trace", "debug", "info", "warn", "error", "fatal"] },
                ns: { type: "string", maxLength: 60 },
                message: { type: "string", maxLength: 500 },
                data: { type: "object" },
                ts: { type: "string" },
                sessionId: { type: "string", maxLength: 40 },
                url: { type: "string", maxLength: 300 }
              }
            }
          }
        }
      },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
    },
    async (req, reply) => {
      dbPush(`logs/client/${req.body.date}`, req.body.entry).catch(() => {
      });
      return reply.status(204).send();
    }
  );
}

// src/routes/notifications.ts
var import_database = require("firebase-admin/database");
var import_uuid = require("uuid");
async function notificationsRoutes(app) {
  const db2 = (0, import_database.getDatabase)();
  const ref = db2.ref("notifications");
  const readsRef = db2.ref("notificationReads");
  app.get("/api/notifications", async (_req, reply) => {
    const snapshot = await ref.orderByChild("status").equalTo("active").once("value");
    const raw = snapshot.val() ?? {};
    const now = /* @__PURE__ */ new Date();
    const notifications = Object.values(raw).filter(
      (n) => !(n.expiresAt && new Date(n.expiresAt) < now)
    );
    return reply.send(notifications);
  });
  app.get(
    "/api/notifications/admin",
    { preHandler: [app.verifyEditor] },
    async (_req, reply) => {
      const snapshot = await ref.once("value");
      const raw = snapshot.val() ?? {};
      const notifications = Object.values(raw).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return reply.send(notifications);
    }
  );
  app.get(
    "/api/notifications/reads",
    { preHandler: [verifyLawyerOrEditor(app)] },
    async (req, reply) => {
      const uid = resolveUid(req);
      if (!uid) return reply.status(401).send({ error: "Unauthorized" });
      const snap = await readsRef.child(uid).once("value");
      return reply.send(snap.val() ?? {});
    }
  );
  app.post(
    "/api/notifications",
    { preHandler: [app.verifyEditor] },
    async (req, reply) => {
      const body = req.body;
      if (!body.title?.trim() || !body.body?.trim()) {
        return reply.status(400).send({ error: "title and body are required" });
      }
      if (!["feature", "info", "warning"].includes(body.type ?? "")) {
        return reply.status(400).send({ error: "invalid type" });
      }
      if (!["all", "lawyers", "editors"].includes(body.audience ?? "")) {
        return reply.status(400).send({ error: "invalid audience" });
      }
      const id = `notif-${(0, import_uuid.v4)().slice(0, 8)}`;
      const notification = {
        id,
        title: body.title.trim(),
        body: body.body.trim(),
        type: body.type ?? "info",
        audience: body.audience ?? "all",
        status: "active",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        ...body.cta?.label && body.cta?.url ? { cta: body.cta } : {},
        ...body.expiresAt ? { expiresAt: body.expiresAt } : {},
        ...req.editorPayload?.id ? { authorId: req.editorPayload.id } : {}
      };
      await ref.child(id).set(notification);
      return reply.status(201).send(notification);
    }
  );
  app.patch(
    "/api/notifications/:id",
    { preHandler: [app.verifyEditor] },
    async (req, reply) => {
      const { id } = req.params;
      const body = req.body;
      const snap = await ref.child(id).once("value");
      if (!snap.exists()) {
        return reply.status(404).send({ error: "Notification not found" });
      }
      const allowed = {};
      if (body.status && ["active", "archived"].includes(body.status)) {
        allowed.status = body.status;
      }
      if (body.expiresAt) {
        allowed.expiresAt = body.expiresAt;
      }
      await ref.child(id).update(allowed);
      return reply.send({ ok: true });
    }
  );
  app.delete(
    "/api/notifications/:id",
    { preHandler: [app.verifyEditor] },
    async (req, reply) => {
      const { id } = req.params;
      await ref.child(id).remove();
      return reply.send({ ok: true });
    }
  );
  app.post(
    "/api/notifications/:id/read",
    { preHandler: [verifyLawyerOrEditor(app)] },
    async (req, reply) => {
      const uid = resolveUid(req);
      if (!uid) return reply.status(401).send({ error: "Unauthorized" });
      await readsRef.child(uid).child(req.params.id).set({
        readAt: (/* @__PURE__ */ new Date()).toISOString(),
        uid
      });
      return reply.send({ ok: true });
    }
  );
}
function verifyLawyerOrEditor(app) {
  return async function(req, reply) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Authentication required." });
    }
    let lawyerPassed = false;
    try {
      await app.verifyLawyer(req, reply);
      lawyerPassed = req.lawyerPayload !== void 0;
    } catch {
    }
    if (lawyerPassed) return;
    await app.verifyEditor(req, reply);
  };
}
function resolveUid(req) {
  if (req.lawyerPayload?.uid) return req.lawyerPayload.uid;
  if (req.editorPayload?.id) return req.editorPayload.id;
  if (req.editorPayload) return "editor";
  return null;
}

// src/routes/calc-config.ts
var CALC_CONFIG_DB_PATH = "public/calcConfig";
var VALID_CALC_TABS = /* @__PURE__ */ new Set([
  "purchase-mortgage",
  "cash-purchase",
  "sale",
  "refinance",
  "wills",
  "incorporation"
]);
var defaultDeps = {
  get: dbGet,
  multiUpdate: dbMultiUpdate,
  now: Date.now
};
function isValidConfig(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return false;
  }
  const obj = body;
  for (const key of Object.keys(obj)) {
    if (!VALID_CALC_TABS.has(key)) return false;
    const tab = obj[key];
    if (typeof tab !== "object" || tab === null) return false;
    const t = tab;
    if (typeof t.fields !== "object" || t.fields === null) return false;
    if (typeof t.disclaimer !== "string") return false;
  }
  for (const expected of VALID_CALC_TABS) {
    if (!(expected in obj)) return false;
  }
  return true;
}
async function calcConfigRoutes(fastify, opts) {
  const deps = {
    get: opts?.get ?? dbGet,
    multiUpdate: opts?.multiUpdate ?? dbMultiUpdate,
    now: opts?.now ?? Date.now
  };
  fastify.get(
    "/",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (req, reply) => {
      try {
        const data = await deps.get(CALC_CONFIG_DB_PATH);
        reply.header("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
        return reply.status(200).send(data ?? {});
      } catch (err) {
        req.log.error({ err }, "Failed to fetch calculator config");
        return reply.status(500).send({ error: "Could not load calculator configuration." });
      }
    }
  );
  fastify.put(
    "/",
    {
      preHandler: [fastify.verifyCalcConfig],
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
    },
    async (req, reply) => {
      const body = req.body;
      if (!isValidConfig(body)) {
        return reply.status(400).send({
          error: "Invalid calculator config. Expected an object with all six tab keys, each containing { fields: {\u2026}, disclaimer: string }."
        });
      }
      try {
        await deps.multiUpdate({
          [CALC_CONFIG_DB_PATH]: body,
          [`public/audit/calcConfig/${deps.now()}`]: {
            action: "calc-config-update",
            at: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
        req.log.info("Calculator config updated");
        return reply.status(204).send();
      } catch (err) {
        req.log.error({ err }, "Failed to update calculator config");
        return reply.status(500).send({ error: "Could not save calculator configuration." });
      }
    }
  );
}

// src/vercel-entry.ts
var _app = null;
async function getApp() {
  if (_app) return _app;
  console.log("[vercel] Cold start \u2014 building Fastify instance");
  initFirebase();
  const fastify = (0, import_fastify.default)({
    logger: false,
    ajv: { customOptions: { strict: false } }
  });
  await fastify.register(import_helmet.default, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  });
  await fastify.register(import_cors.default, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = [
        "https://localhost:4422",
        "https://fl-legal.ca",
        "https://www.fl-legal.ca",
        "https://staging.fl-legal.ca"
      ];
      if (allowed.includes(origin) || /\.vercel\.app$/.test(origin) || config2.isDev && /localhost/.test(origin)) {
        return cb(null, true);
      }
      cb(new Error(`CORS blocked: ${origin}`), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  });
  await fastify.register(import_rate_limit.default, {
    max: 200,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? req.ip ?? "unknown"
  });
  await fastify.register(auth_default);
  fastify.get(
    "/api/health",
    async (_req, reply) => reply.send({ ok: true, ts: (/* @__PURE__ */ new Date()).toISOString() })
  );
  fastify.register(authRoutes, { prefix: "/api/auth" });
  fastify.register(contentRoutes, { prefix: "/api/content" });
  fastify.register(blogRoutes, { prefix: "/api/blog" });
  fastify.register(inquiryRoutes, { prefix: "/api/inquiries" });
  fastify.register(profileRoutes, { prefix: "/api/profiles" });
  fastify.register(logRoutes, { prefix: "/api/logs" });
  fastify.register(notificationsRoutes, { prefix: "/api/notifications" });
  fastify.register(calcConfigRoutes, { prefix: "/api/calc-config" });
  await fastify.ready();
  _app = fastify;
  console.log("[vercel] Fastify ready");
  return fastify;
}
async function handler(req, res) {
  try {
    const app = await getApp();
    let payload;
    if (req.body !== void 0 && req.body !== null) {
      payload = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }
    const result = await app.inject({
      method: req.method ?? "GET",
      url: req.url ?? "/",
      headers: req.headers,
      payload
    });
    for (const [key, value] of Object.entries(result.headers)) {
      if (value !== void 0) res.setHeader(key, value);
    }
    res.statusCode = result.statusCode;
    res.end(result.rawPayload);
  } catch (err) {
    console.error("[vercel] Unhandled error in handler:", err?.message ?? err);
    console.error("[vercel] Stack:", err?.stack ?? "(no stack)");
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}
