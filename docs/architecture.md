# PeerLoop Architecture

## Architectural direction

PeerLoop should remain a **modular monolith**: one Node/Express deployment with feature-owned backend modules, a separate browser build, and the Solidity contract. Keep the modules independently testable and enforce explicit dependency direction; extract a separately deployed service only when a concrete scaling, isolation, or ownership need justifies the operational cost.

## Current system map

```text
Browser
  ├─ React entry: frontend/src/client/app.tsx
  │    └─ shared UI + landing, marketplace, listings, cart, and account features
  ├─ typed API facade: frontend/src/client/apiClient.ts
  ├─ contract ABI script, then legacy TypeScript scripts in frontend/src/document.ts order
  │    └─ wallet/contract/history/auth/cart/marketplace/UI behavior
  ├─ HTTP API calls ──────────────────────────────┐
  ├─ Sepolia RPC / Blockscout reads               │
  └─ Socket.IO product events                     │
                                                  ▼
Backend process                                  backend/app.ts
  ├─ middleware: security, CORS, rate limiting   ├─ routes/apiRouter.ts → feature routers
  ├─ health routes: routes/healthRouter.ts       ├─ auth module
  ├─ Mongo connection                             ├─ upload module → Pinata/IPFS
  ├─ Socket.IO                                    ├─ listing metadata → repository + RPC owner check
  └─ process lifecycle                            └─ public config module
  └─ contract event poller → Socket.IO emit

smart-contract/contracts/Marketplace.sol
  └─ listing, purchase, and escrow state on Sepolia
```

The backend app and lifecycle are now separate: `backend/app.ts` composes middleware and top-level routers; `backend/routes/apiRouter.ts` owns API feature mounting; `backend/routes/healthRouter.ts` owns liveness/readiness response behavior; and `backend/server.ts` owns process startup, Mongo connection, HTTP/Socket.IO creation, the chain listener, and shutdown. `backend/middleware/security.ts` and `ipRateLimiter.ts` give shared HTTP policy focused responsibilities. The `createApp` factory can be exercised without starting the database, chain listener, or production process. `/health/live` is a liveness probe; `/health/ready` and its backwards-compatible `/health` alias report HTTP 503 until MongoDB is connected. The bounded in-memory IP limiter is per process, not a distributed limiter.

## Backend boundaries

- `backend/modules/auth/` owns wallet challenges, signature verification, session issuance, routes, and the Mongo user repository.
- `backend/modules/uploads/` owns upload routes, image validation, upload service, and Pinata storage integration.
- `backend/modules/listing-metadata/` owns category metadata routes, application logic, persistence, and the on-chain listing-owner lookup.
- `backend/modules/public-config/` exposes public runtime configuration.
- `backend/models/` contains Mongoose schemas. `backend/config.ts` owns backend configuration parsing.
- `backend/contractListener.ts` polls the contract and publishes product changes to Socket.IO; the server controls its lifecycle.

Preferred dependency direction is `router → controller → service → repository/provider`. Keep HTTP concerns in routers/controllers, policy in middleware, persistence behind repositories, and runtime composition at `routes/apiRouter.ts`, `app.ts`, and `server.ts`. `healthRouter.ts` receives database status through a callback rather than importing runtime/database state. A feature module should not import another feature's private repository or route; shared needs should be exposed through a small interface or a clearly named shared module.

The old `backend/routes/products.ts` and `users.ts` files and corresponding product/user models are not mounted by the current server. They are retained for now; verify history and intended data compatibility before deleting or reconnecting them.

## Frontend boundaries and current coupling

React's entry is `frontend/src/client/app.tsx`; components live under `features/` and `shared/`. The generated document loads the React bundle, then `apiTransport.js` and the browser bootstrap `apiClient.js`, followed by `money.js` and the older browser scripts (`utils`, contract ABI/runtime, history, wallet detection, animations, UI, auth, account dashboard, marketplace, cart, custom select, and main startup).

Those older files are compiled as classic global scripts, not imported ES modules. They share mutable top-level state and call each other's global functions; `frontend/src/types.d.ts` still declares several globals as `any`. `main.ts` coordinates startup and real-time updates; `money.ts` owns precise ETH/wei parsing, formatting, summation, and comparison and exposes the existing `window.PeerLoopMoney` compatibility facade; `utils.ts` contains the remaining shared browser helpers/state; and `contract.ts` owns deployment constants, RPC setup, and read/write behavior. The large browser ABI declaration has been moved to `contracts/marketplaceAbi.ts` and is loaded immediately before the contract runtime. Backend HTTP traffic goes through `apiTransport.ts`, a dependency-injected API service factory, and `apiClient.ts`, a narrow browser bootstrap that resolves the API base URL and installs the existing typed facade on `window.PeerLoopApi`. These focused services isolate request and money behavior without changing their global compatibility contracts or converting every browser file into an ES module. External Blockscout/RPC reads and Socket.IO remain separate integrations. React feature components are better isolated, but still coordinate with the older code through DOM IDs, browser globals, and shared events.

This is the largest coupling area. Do not bulk-convert files to modules: script execution order, wallet state, DOM behavior, and checkout flows are implicit contracts. Migrate one feature at a time, add behavior tests first, and keep a small compatibility adapter until each old global has no remaining consumers.

## Contract and event flow

The Solidity contract is the source of truth for listings, purchases, and escrow. The browser reads/writes it through ethers and submits transactions from the user's wallet. The backend's `contractListener.ts` independently polls product and escrow lifecycle events and emits `product_updated` messages; the browser's Socket.IO handler refreshes or adjusts the visible marketplace and history. The buyer may release or refund active escrow or open a dispute. During a dispute, buyer and seller must match votes to settle; there is no fulfillment-evidence workflow, deadline, automatic refund, or dispute timeout. If the parties do not agree, funds remain locked indefinitely. Settlement credits pull-payment balances rather than pushing ETH inside the resolution transaction.

The frontend and backend currently maintain separate contract ABI representations. The browser ABI is a dedicated file and the backend listener declares only the event fragments it polls, but they are not yet generated from one canonical ABI artifact. This can drift when contract events change. Keep RPC and wallet transaction responsibilities separate: backend listener/read access must not take custody of user signing.

## Tests and verification boundaries

Backend tests cover config, app health/CORS composition, wallet authentication, listing metadata, public config, and image upload behavior. Frontend API-service runtime tests exercise URL normalization, credential inclusion, JSON requests, multipart upload, and API error mapping. `npm run build` compiles backend/scripts, frontend TypeScript/React, and Solidity TypeScript tooling; `npm run lint` covers authored backend/scripts/tests/frontend files. There is not yet a browser-level regression suite for the React/legacy integration or a dedicated contract-listener fake-provider suite.

When changing a feature, preserve its API/route contract and add tests at the layer changed: service unit tests for business rules, router tests for status/body/auth behavior, and app tests for middleware/wiring. Use browser/E2E coverage before replacing global frontend workflows.

## Repository responsibilities and change boundaries

| Area | Current ownership | Allowed dependency direction |
| --- | --- | --- |
| `backend/modules/auth/` | Wallet challenge, signature verification, JWT session, cookie routes, and user repository | Router → controller → service → user repository/model |
| `backend/modules/uploads/` | Authenticated multipart upload, MIME/signature validation, upload orchestration, Pinata/IPFS provider | Router → upload service → storage interface → Pinata adapter |
| `backend/modules/listing-metadata/` | Category metadata API, persistence, contract-owner verification, chain reader | Router → controller → service → repository/marketplace reader |
| `backend/modules/public-config/` | Public RPC URL and config health responses | Router → public config values; never expose secrets or server-only credentials |
| `backend/routes/` | Top-level API route registration and liveness/readiness routes | Route composition → feature routers; health receives status callback |
| `backend/server.ts` | Process startup, Mongo connection, HTTP/Socket.IO server, listener lifecycle, shutdown | Runtime composition only; it must not own feature business rules |
| `frontend/src/client/features/` and `shared/` | React presentation; several components retain stable DOM IDs for compatibility | UI components → shared UI and explicit feature props; avoid owning legacy globals |
| `frontend/src/client/apiTransport.ts` | API endpoint methods, response parsing, credentialed requests, errors/timeouts | Injected URL/fetch/form-data dependencies; no DOM or URL discovery |
| `frontend/src/client/apiClient.ts` | Browser configuration and `window.PeerLoopApi` adapter | Bootstrap → transport factory; compatibility surface only |
| `frontend/src/client/money.ts` | Exact decimal ETH/wei domain arithmetic | Pure calculations → `window.PeerLoopMoney` compatibility adapter |
| Other classic `frontend/src/client/*.ts` | Wallet, history, marketplace, checkout, account and DOM workflows | Until migrated, keep current script order, names and globals as explicit compatibility dependencies |
| `smart-contract/` | On-chain marketplace rules, deployment, Solidity tests, generated ABI sync | Solidity source → artifact → generated clients; no frontend/backend changes should silently change deployed behavior |
| `scripts/`, root manifests, `tests/` | Local process orchestration, build coordination and regression checks | Scripts coordinate applications; they should not duplicate application business logic |

### Behavior and data invariants

- Keep the existing API paths and auth/upload/metadata/config status, payload, cookie, CORS, Origin-validation, and rate-limit behavior. Router extraction is composition-only; the app-level middleware order is intentional.
- Keep Mongo schemas, collection names, unique constraints, wallet normalization, auth versioning and metadata keys stable unless a separately reviewed migration is designed. No database migration is part of the current refactor.
- Do not mount, delete, or rewrite `backend/routes/products.ts` or `users.ts` based only on the lack of in-repository callers. They are dormant in the current app but may represent an external compatibility surface; confirm consumers and add route tests first.
- Keep `window.PeerLoopApi`, `window.PeerLoopMoney`, existing event names, route/section behavior, legacy script globals, DOM IDs, and document script order stable while compatibility adapters remain.
- Treat the deployed contract and its state as external durable data. ABI changes may need new deployments; redeploying resets product/escrow IDs and does not migrate old listings/history. Never deploy or modify production chain state as part of architecture cleanup.
- Keep Socket.IO `product_updated` event names/payloads and listener stop behavior stable. The listener is not a durable event store; frontend consumers must continue reconciling against chain reads.
- Keep root `npm test` and the separate Hardhat contract suite distinct: `npm run build` type-checks contract tooling but does not compile Solidity; run `npm test` inside `smart-contract/` to exercise Solidity behavior.

### Known coupling, prioritized by risk

1. **Highest risk — browser integration:** React markup and classic scripts share DOM IDs, global state, section visibility and fixed script order. Add browser-level workflow coverage before changing routing, cart/checkout, wallet, auth, history, or markup ownership.
2. **High risk — chain configuration and ABI drift:** browser ABI generation, backend event fragments, frontend deployment address/block, and backend environment configuration are not one canonical deployment artifact. Add drift checks and a validated deployment manifest before changing those interfaces.
3. **High risk — unknown dormant API consumers:** product/user routers access models directly and have no current in-repo mounting or tests. Keep intact until external usage is determined; if activated, add compatibility tests and repository/service seams first.
4. **Medium risk — process lifecycle:** the backend server currently combines Mongo, DNS, Socket.IO, event listener, logging and signal shutdown. Extract lifecycle helpers only with injectable dependencies and tests for connection failure, shutdown, and event delivery.
5. **Medium risk — distributed configuration:** backend configuration parsing is centralized for core server settings, but selected chain, storage and module behaviors still read environment variables directly. Introduce typed config slices with preserved defaults/validation before eliminating direct reads.

The practical target is still a modular monolith, not a service-per-feature system. Prefer feature-owned code, typed interfaces, dependency injection at composition roots, and compatibility adapters over broad directory moves or new infrastructure.

## Safe evolution plan

1. **Completed:** extract HTTP app composition, security headers/HTTPS redirect, and IP rate limiting from process startup; add an app integration test for health output and credentialed CORS. API mounting and health probes now have focused routers composed by the app.
2. **Completed:** centralize backend API requests behind typed auth, upload, metadata, and public-config methods. Preserve endpoint paths and cookie credentials; add VM-based service tests.
3. **Completed in part:** move the browser ABI into its own load-ordered source file and test its availability before contract runtime initialization; separate API transport behavior from browser URL bootstrap while retaining `window.PeerLoopApi`; extract precision-sensitive ETH/wei arithmetic from generic browser utilities while retaining `window.PeerLoopMoney`. Next add browser workflow tests and gradually isolate history, wallet/contract access, marketplace state, and cart state behind feature interfaces. Replace globals with imports or a narrow compatibility facade only when regression coverage exists.
4. **Then:** generate and validate a shared deployment/ABI manifest without changing deployed contract behavior; inject listener configuration and provider dependencies, add fake-provider polling/reorg/deduplication tests, and make one generated ABI artifact consumable by both browser and backend builds.
5. **Then:** separate pure browser/domain logic from DOM adapters one small feature at a time; add tests for globals and script-load order before converting any classic scripts to modules.
6. **Then:** extract server lifecycle pieces behind interfaces and test Mongo, Socket.IO and chain-listener startup/shutdown behavior without touching production infrastructure.
7. **Cleanup only after reference checks:** decide whether the unmounted Mongo product/user routes and models are obsolete or need a data migration. Do not delete them as part of routine modularization. Preserve their route contracts if they have external consumers.

This plan favors changes that can be reviewed and rolled back independently. It does not require microservices, a database migration, or a new framework.
