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
  ├─ middleware: security, CORS, rate limiting   ├─ auth module
  ├─ Express feature routers                     ├─ upload module → Pinata/IPFS
  ├─ Mongo connection                             ├─ listing metadata → repository + RPC owner check
  ├─ Socket.IO                                    └─ public config module
  └─ contract event poller → Socket.IO emit

smart-contract/contracts/Marketplace.sol
  └─ listing, purchase, and escrow state on Sepolia
```

The backend app and lifecycle are now separate: `backend/app.ts` composes middleware and feature routers; `backend/server.ts` owns process startup, Mongo connection, HTTP/Socket.IO creation, the chain listener, and shutdown. `backend/middleware/security.ts` and `ipRateLimiter.ts` give shared HTTP policy focused responsibilities. The `createApp` factory can be exercised without starting the database, chain listener, or production process. `/health/live` is a liveness probe; `/health/ready` and its backwards-compatible `/health` alias report HTTP 503 until MongoDB is connected. The bounded in-memory IP limiter is per process, not a distributed limiter.

## Backend boundaries

- `backend/modules/auth/` owns wallet challenges, signature verification, session issuance, routes, and the Mongo user repository.
- `backend/modules/uploads/` owns upload routes, image validation, upload service, and Pinata storage integration.
- `backend/modules/listing-metadata/` owns category metadata routes, application logic, persistence, and the on-chain listing-owner lookup.
- `backend/modules/public-config/` exposes public runtime configuration.
- `backend/models/` contains Mongoose schemas. `backend/config.ts` owns backend configuration parsing.
- `backend/contractListener.ts` polls the contract and publishes product changes to Socket.IO; the server controls its lifecycle.

Preferred dependency direction is `router → controller → service → repository/provider`. Keep HTTP concerns in routers/controllers, policy in middleware, persistence behind repositories, and runtime composition at `app.ts`/`server.ts`. A feature module should not import another feature's private repository or route; shared needs should be exposed through a small interface or a clearly named shared module.

The old `backend/routes/products.ts` and `users.ts` files and corresponding product/user models are not mounted by the current server. They are retained for now; verify history and intended data compatibility before deleting or reconnecting them.

## Frontend boundaries and current coupling

React's entry is `frontend/src/client/app.tsx`; components live under `features/` and `shared/`. The generated document loads the React bundle, then `apiClient.js`, followed by the older browser scripts (`utils`, `contract`, `history`, wallet detection, animations, UI, auth, account dashboard, marketplace, cart, custom select, and main startup).

Those older files are compiled as classic global scripts, not imported ES modules. They share mutable top-level state and call each other's global functions; `frontend/src/types.d.ts` still declares several globals as `any`. `main.ts` coordinates startup and real-time updates, `utils.ts` supplies shared state/helpers, and `contract.ts` owns deployment constants, RPC setup, and read/write behavior. The large browser ABI declaration has been moved to `contracts/marketplaceAbi.ts` and is loaded immediately before the contract runtime. Backend HTTP traffic goes through `apiClient.ts`, which exposes typed auth, upload, listing-metadata, and public-config methods and applies cookie credentials in one place. It is an explicit compatibility facade on `window.PeerLoopApi`, not a conversion of the whole browser to ES modules. External Blockscout/RPC reads and Socket.IO remain separate integrations. React feature components are better isolated, but still coordinate with the older code through DOM IDs, browser globals, and shared events.

This is the largest coupling area. Do not bulk-convert files to modules: script execution order, wallet state, DOM behavior, and checkout flows are implicit contracts. Migrate one feature at a time, add behavior tests first, and keep a small compatibility adapter until each old global has no remaining consumers.

## Contract and event flow

The Solidity contract is the source of truth for listings, purchases, and escrow. The browser reads/writes it through ethers and submits transactions from the user's wallet. The backend's `contractListener.ts` independently polls product and escrow lifecycle events and emits `product_updated` messages; the browser's Socket.IO handler refreshes or adjusts the visible marketplace and history. The buyer may release or refund active escrow or open a dispute. During a dispute, buyer and seller must match votes to settle; there is no fulfillment-evidence workflow, deadline, automatic refund, or dispute timeout. If the parties do not agree, funds remain locked indefinitely. Settlement credits pull-payment balances rather than pushing ETH inside the resolution transaction.

The frontend and backend currently maintain separate contract ABI representations. The browser ABI is a dedicated file and the backend listener declares only the event fragments it polls, but they are not yet generated from one canonical ABI artifact. This can drift when contract events change. Keep RPC and wallet transaction responsibilities separate: backend listener/read access must not take custody of user signing.

## Tests and verification boundaries

Backend tests cover config, app health/CORS composition, wallet authentication, listing metadata, public config, and image upload behavior. Frontend API-service runtime tests exercise URL normalization, credential inclusion, JSON requests, multipart upload, and API error mapping. `npm run build` compiles backend/scripts, frontend TypeScript/React, and Solidity TypeScript tooling; `npm run lint` covers authored backend/scripts/tests/frontend files. There is not yet a browser-level regression suite for the React/legacy integration or a dedicated contract-listener fake-provider suite.

When changing a feature, preserve its API/route contract and add tests at the layer changed: service unit tests for business rules, router tests for status/body/auth behavior, and app tests for middleware/wiring. Use browser/E2E coverage before replacing global frontend workflows.

## Safe evolution plan

1. **Completed:** extract HTTP app composition, security headers/HTTPS redirect, and IP rate limiting from process startup; add an app integration test for health output and credentialed CORS.
2. **Completed:** centralize backend API requests behind typed auth, upload, metadata, and public-config methods. Preserve endpoint paths and cookie credentials; add VM-based service tests.
3. **Completed in part:** move the browser ABI into its own load-ordered source file and test its availability before contract runtime initialization. Next add browser workflow tests and gradually isolate history, wallet/contract access, marketplace state, and cart state behind feature interfaces. Replace globals with imports or a narrow compatibility facade only when regression coverage exists.
4. **Then:** inject listener configuration and provider dependencies, add fake-provider polling/reorg/deduplication tests, and make one generated ABI artifact consumable by both browser and backend builds.
5. **Cleanup only after reference checks:** decide whether the unmounted Mongo product/user routes and models are obsolete or need a data migration. Do not delete them as part of routine modularization.

This plan favors changes that can be reviewed and rolled back independently. It does not require microservices, a database migration, or a new framework.
