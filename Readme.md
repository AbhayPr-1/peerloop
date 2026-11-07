# PeerLoop

PeerLoop is a peer-to-peer marketplace built around an Ethereum smart contract. Users connect a MetaMask wallet to list and buy products. The application also includes a Node.js backend for user sessions, image uploads, and live marketplace updates.

## How it works

- The Solidity contract handles product listings and escrow-backed purchases. Buyers release payment to the seller or refund it from Purchase History.
- The Express backend manages wallet-based login, user data, image uploads, and runtime health checks.
- Product images are uploaded to Pinata and stored as canonical IPFS URIs; the frontend uses a fast gateway first and falls back to alternate gateways if needed.
- Marketplace reads race validated Sepolia RPC endpoints so a slow or unavailable endpoint does not block Explore.
- An Ethers.js listener watches contract events and sends updates to the frontend through Socket.IO.
- The backend, startup tools, and browser application are written in TypeScript. React mounts the browser UI from a TypeScript-generated document; existing marketplace behaviors are initialized after the React render. Cart data is stored in the browser.

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
For production, serve the frontend over HTTPS. By default, the frontend uses its own origin for API and Socket.IO requests, so configure a reverse proxy to forward `/api` and `/socket.io` to the backend. If the backend has a separate HTTPS origin, set `window.PEERLOOP_API_URL` before the frontend scripts load. Configure the backend's `APP_ORIGIN` to match the exact frontend origin.

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

Marketplace purchases use `buyProductWithEscrow`: funds remain in the contract until the buyer releases them to the seller or requests a refund. A successful refund returns the full held amount to the buyer (transaction gas is paid separately), restores the product to the seller's active listings, and clears its sold/buyer fields. The seller is not debited because escrow funds are not paid to the seller until release. Escrow status and actions are available from the Escrow view and My Purchases; refunded items remain visible as refunded in the seller's Sold History. Confirmed escrow actions update the profile immediately while event indexing catches up. After changing the contract, redeploy it and rebuild/restart the app so the frontend points at the new deployment. Purchases made through the old direct-purchase flow are not escrowed.

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

Listings and purchases are sent directly to the smart contract. Sold History and Purchase History are built from the contract's `ProductSold` and escrow lifecycle events. The cart is stored in browser local storage. The legacy MongoDB product and user route modules are not mounted by the current server.

The contract does not store product categories. The backend persists the selected category as listing metadata after verifying the listing owner on-chain. This means categories require the backend, MongoDB, and a valid `CONTRACT_ADDRESS` and `SEPOLIA_RPC_URL`; metadata is scoped to the deployed contract address.

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

The contract listener currently polls for live updates. History is read from the deployed contract's sale events and cached for the current page session; it does not require a contract redeployment. The frontend waits briefly before refreshing product data after transactions or events to reduce timing issues while the chain updates. The backend uses `SEPOLIA_RPC_URL` for its listener; the browser uses the public Sepolia RPC endpoint instead of receiving a credential-bearing URL.

Possible future work includes storing categories on-chain, adding a formal dispute-resolution process, supporting additional storage providers, and deploying to a layer-2 network.
