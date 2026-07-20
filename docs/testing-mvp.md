# Automated Test Suite MVP

This project now has a small but meaningful automated suite built around the highest-risk seams:

- Server auth decorators: role checks, malformed JWTs, and request payload decoration.
- Calculator config API: public reads, calc-only writes, schema validation, and atomic Firebase update shape.
- Client calculation utilities under `client/test`: land-title fee boundaries, rounding, and HTML escaping.
- Client navigation utility under `client/test`: stable route animation ordering.

Run everything from the repo root:

```sh
npm test
```

Run each side independently:

```sh
npm run test:server
npm run test:client
```

The scripts use Node's built-in test runner with V8 coverage enabled through `--experimental-test-coverage`.

## Next Coverage Targets

- Extract the Fastify app construction from `server/src/api.ts` into an app factory so health, CORS, helmet, static-file, and route registration behavior can be tested without starting a listener or initializing Firebase.
- Add Angular component tests for the calculator tabs once the calculator state is split into smaller pure calculation helpers and UI adapters.
- Add contract tests for content, blog, inquiry, and calendar routes using dependency-injected Firebase and mailer adapters.
- Add one Playwright smoke flow for the public site: home page renders, navigation reaches pricing, calculator produces an estimate, and the contact form validates required fields.
