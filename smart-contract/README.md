# PeerLoop Smart Contract

This project uses Hardhat 3 to compile and deploy the PeerLoop marketplace contract.

## Install

```shell
npm install
```

For Sepolia deployment, set `SEPOLIA_RPC_URL` and a valid 32-byte `PRIVATE_KEY` in `.env`.
The Sepolia network is enabled only when both values are configured.

## Compile and test

```shell
npm run compile
npm test
```

## Deploy

Deploy to Sepolia:

```shell
npm run deploy
```

For a local deployment, start a local Hardhat node in one terminal and deploy from another:

```shell
npx hardhat node
npm run deploy:local
```

After deployment, the script updates the marketplace address in `frontend/src/client/contract.ts`
and the root `.env`.
