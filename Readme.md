# PeerLoop

See [docs/architecture.md](docs/architecture.md) for the module map, dependency boundaries, and staged refactoring plan.

PeerLoop is a peer-to-peer marketplace built around an Ethereum smart contract. Users connect a MetaMask wallet to list and buy products. The application also includes a Node.js backend for user sessions, image uploads, and live marketplace updates.

## How it works

- The Solidity contract handles product listings and escrow-backed purchases. Buyers release payment to the seller or refund it from Purchase History.
- The Express backend manages wallet-based login, user data, image uploads, and liveness/readiness checks.
- Product images are uploaded to Pinata and stored as canonical IPFS URIs; the frontend uses a fast gateway first and falls back to alternate gateways if needed.
- Marketplace reads race validated Sepolia RPC endpoints so a slow or unavailable endpoint does not block Explore.
- An Ethers.js listener watches contract events and sends updates to the frontend through Socket.IO.
- The backend, startup tools, and browser application are written in TypeScript. React mounts the browser UI from a TypeScript-generated document. The cart, theme choice, and transaction-history cache are kept in page memory and reset on reload; authentication is maintained by a server-issued HttpOnly cookie.
- Tailwind utility styles are compiled locally as part of the frontend build; the browser does not load Tailwind from a CDN.
- The account dashboard is isolated in its own frontend module; profile activity dates come from the corresponding Sepolia block timestamp.
- ETH prices remain decimal strings in the browser and are converted to integer wei for comparisons, totals, and transaction input. Cart checkout reports each item and links successful transactions; failed items remain in the cart.

## Requirements

- Node.js 18 or later
- MongoDB, either local or hosted
- MetaMask
- An Alchemy or Infura Sepolia RPC URL
- Pinata credentials for image uploads

Hardhat is installed with the smart-contract dependencies; a global installation is not required.

## Quick start

Clone the repository and install its dependencies:

```bash
git clone https://github.com/AbhayPr-1/peerloop.git
cd peerloop
npm run setup
```

The setup command installs dependencies, builds the TypeScript projects, and creates the environment-file templates. Add your configuration values to the generated `.env` files, then start the application:

```bash
npm run dev
```

The frontend is served at [http://localhost:3000](http://localhost:3000). The backend runs on port 5001.
If either default port is busy, `npm run dev` selects the next available port and prints the actual frontend and backend URLs; use the printed frontend URL.

## Configuration

Set the following values in the root `.env` file:

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port; defaults to `5001`. |
| `MONGO_URI` | MongoDB connection string. |
| `JWT_SECRET` | Secret used to sign session tokens. The setup script can generate one. |
| `SEPOLIA_RPC_URL` | Backend RPC endpoint used by the contract event listener. It is not sent to the browser. |
| `APP_ORIGIN` | Allowed frontend origin; defaults to `http://localhost:3000`. Set this to the deployed frontend URL in production. |
| `CONTRACT_ADDRESS` | Address of the deployed marketplace contract. |
| `PRIVATE_KEY` | Wallet key used for contract deployment. |
| `PINATA_JWT` | Optional Pinata credential for IPFS uploads. |

Never commit `.env` files or share private keys. They are excluded by `.gitignore`.
For production, serve the frontend over HTTPS. By default, the frontend uses its own origin for API and Socket.IO requests, so configure a reverse proxy to forward `/api` and `/socket.io` to the backend. If the backend has a separate HTTPS origin, set `PEERLOOP_API_URL` in the frontend server environment so the strict Content Security Policy permits that exact API and Socket.IO origin. Configure the backend's `APP_ORIGIN` to the exact frontend origin(s); cookie-authenticated writes and sign-in requests require a matching `Origin` header.

## Smart contract

To compile the contract:

```bash
npm run contracts:compile
```

To deploy to Sepolia:

```bash
npm run contracts:deploy
```

The deploy script updates the contract address in the root environment and `frontend/src/client/contract.ts`. For local development, use:

```bash
npm run contracts:deploy:local
```

Marketplace purchases use `buyProductWithEscrow`. The buyer may release or refund an active escrow, or open a dispute. During a dispute, the buyer and seller must choose the same outcome to settle. There is no fulfillment-evidence workflow, deadline, automatic refund, or dispute timeout. If the parties do not agree, the funds remain locked indefinitely; this is a known limitation, not an audited or recommended dispute policy.

Settlement credits the winning party's `pendingWithdrawals` balance instead of sending ETH inline. The payee then calls `withdrawPayments`; this avoids a rejecting wallet blocking escrow settlement. Refunded items are relisted and remain in seller history. Escrow records are stored by unique escrow ID so later purchases cannot overwrite prior purchase state.

The contract source does not expose a direct `buyProduct` path. Source changes do not modify an already deployed contract: a replacement deployment is required for these changes to take effect on-chain. Redeployment changes the contract address and starts new product/escrow IDs. Existing on-chain listings and their transaction history are not automatically migrated or shown by the new deployment, and categories are scoped to contract address. Review the migration/history implications and new address before deploying.

On-chain listing validation limits names to 100 UTF-8 bytes, descriptions to 2,000 UTF-8 bytes, image metadata to 4,096 UTF-8 bytes, and prices to greater than zero. Browser form limits mirror these constraints. Pagination is cursor-based with scans capped at 100 product IDs.

## Available commands

| Command | Description |
| --- | --- |
| `npm run setup` | Install dependencies and create environment-file templates. |
| `npm run build` | Type-check and compile the backend, scripts, frontend, and Hardhat TypeScript files. |
| `npm run dev` | Start the backend and frontend for development. |
| `npm run prod` | Start both servers without development hot reload. |
| `npm run dev:backend` | Start the backend with nodemon. |
| `npm run dev:frontend` | Serve the frontend on port 3000. |
| `npm start` | Start the backend in production mode. |
| `npm run verify` | Run lint, Solidity compilation, ABI parity checks, backend/frontend tests, contract tests, and the full build. |
| `npm run test:contracts` | Run the Hardhat contract test suite. |
| `npm run test:abi` | Verify generated browser ABI and backend listener events against the compiled contract artifact. |
| `npm run check:abi` | Compile/sync the contract ABI and fail if the checked-in browser ABI would change. |
| `npm run typecheck` | Run strict checks for the backend config module and selected typed browser boundaries without changing the legacy project-wide compiler settings. |
| `npm run typecheck:config` | Strict-check validated backend runtime configuration. |
| `npm run typecheck:browser-boundaries` | Strict-check API transport and ETH/wei domain modules. |
| `npm run contracts:compile` | Compile the Solidity contracts. |
| `npm run contracts:deploy` | Deploy the contract to Sepolia. |
| `npm run contracts:deploy:local` | Deploy to a local Hardhat network. |

## Manual setup

Install root dependencies and configure the root `.env` file:

```bash
npm install
npm run build
```

Install smart-contract dependencies and configure its environment as needed:

```bash
cd smart-contract
npm install
```

To run individual processes from the project root:

```bash
node ./dist/backend/server.js
node ./dist/scripts/frontend-dev.js
```

The authored TypeScript is under `backend/`, `scripts/`, `frontend/src/`, and `smart-contract/`. The React entry point is `frontend/src/client/app.tsx`. `npm run build` writes compiled output to `dist/` and `frontend/dist/`. The HTML document is generated by `frontend/src/document.ts`; there is no checked-in `index.html`.

## API routes

| Method | Path | Purpose | Authentication |
| --- | --- | --- | --- |
| `POST` | `/api/auth/nonce` | Create a short-lived wallet sign-in challenge. | No |
| `POST` | `/api/auth/metamask` | Verify the wallet's signature and issue a session token. | No |
| `POST` | `/api/upload` | Upload an image to Pinata/IPFS. | Yes |
| `GET` | `/api/config/rpc-url` | Retrieve the public Sepolia RPC URL. | No |

Listings and purchases are sent directly to the smart contract. Sold History and Purchase History are built from the contract's `ProductSold` and escrow lifecycle events. Cart contents are page-memory only and do not persist across reloads. The legacy MongoDB product and user route modules are not mounted by the current server.

The contract exposes `getForSaleProductsPage(cursor, scanLimit)` with a maximum scan limit of 100 product IDs; the legacy full-list getter remains for old clients. The browser uses pages when the deployed contract supports them and falls back to the legacy getter for the current deployment. The contract stores escrow records in an escrow-ID history mapping in addition to the product-ID compatibility mapping. These contract changes take effect only after a new deployment; no deployment is performed by this project review.

The contract does not store product categories. The backend persists the selected category as listing metadata after verifying the listing owner on-chain. This means categories require the backend, MongoDB, and a valid `CONTRACT_ADDRESS` and `SEPOLIA_RPC_URL`; metadata is scoped to the deployed contract address.

`GET /health/live` reports whether the backend process is running. `GET /health/ready` (also available at `/health` for compatibility) returns HTTP 503 until MongoDB is connected. In-memory IP rate limits are bounded per process and are not shared across instances; production deployments with multiple backend replicas should use a shared rate-limit store and configure Express proxy trust to match the actual reverse-proxy topology.

GitHub Actions runs `npm run verify` on pushes and pull requests after installing both dependency lockfiles. Run the same command locally before proposing a change. The contract event listener remains an in-memory poller; the new fake-provider tests protect its event payload and stop behavior, but they do not provide durable replay or chain-reorganization recovery.

## Technology

- Solidity and Hardhat
- Node.js and Express
- MongoDB and Mongoose
- Ethers.js and Socket.IO
- React and TypeScript
- Pinata and IPFS
- Ethereum Sepolia testnet

## Troubleshooting

- If setup fails, check that Node.js 18 or later is installed and run `npm run build` to see TypeScript diagnostics. On Windows, try Command Prompt or Git Bash if PowerShell blocks scripts.
- If MongoDB cannot connect, make sure the database is running or verify `MONGO_URI`.
- If MetaMask does not connect, switch it to Sepolia and make sure the browser extension is enabled.
- If contract events are not detected, check `SEPOLIA_RPC_URL` and `CONTRACT_ADDRESS`.
- If image uploads fail, check the Pinata credentials in `.env`.
- If the frontend cannot reach the backend, confirm that the backend is running on port 5001.

## Notes

The contract listener currently polls for live updates. Profile history uses Blockscout's indexed logs, with a direct Sepolia RPC fallback if the indexer is unavailable. The frontend caches loaded history for the current page session. When deploying a new marketplace contract, update both `marketplaceAddress` and `marketplaceDeploymentBlock` in `frontend/src/client/contract.ts`; the deployment block bounds the RPC history fallback. The frontend waits briefly before refreshing product data after transactions or events to reduce timing issues while the chain updates. The backend uses `SEPOLIA_RPC_URL` for its listener; the browser uses public Sepolia RPC endpoints instead of receiving a credential-bearing URL.

Possible future work includes storing categories on-chain, adding a formal dispute-resolution process, supporting additional storage providers, and deploying to a layer-2 network.
