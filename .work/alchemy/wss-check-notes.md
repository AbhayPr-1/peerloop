# Alchemy WSS setup and verification notes

## Official Alchemy docs

- Subscription API overview: https://www.alchemy.com/docs/reference/subscription-api
  - WebSocket URL is available from the Alchemy Dashboard app page via View Key and Network tab; the WebSocket URL differs from HTTP URL.
  - Free-tier limit: 100 WebSocket connections; up to 1,000 subscriptions per connection.
  - Subscription usage is billed based on delivered bandwidth; keep filters narrow and watch usage.
- Alchemy pricing: https://www.alchemy.com/pricing
  - Free plan shows 30M compute units/month and 15 requests/second, full developer platform.
- Official Sepolia setup tutorial: https://www.alchemy.com/docs/how-to-deploy-a-smart-contract-to-the-sepolia-testnet
  - Sign in, open Apps, create an app, choose chain/network, then use app details/API key.
- Dashboard apps: https://dashboard.alchemy.com/apps
- PublicNode Sepolia page: https://ethereum.publicnode.com/?sepolia
  - Page lists a Sepolia WS RPC option and HTTP endpoint; actual endpoint may be rate-limited.
- Ethereum.org WebSocket overview: https://ethereum.org/developers/tutorials/using-websockets/
  - Provider supplies WSS endpoint; public endpoints can be rate-limited and subscription coverage may vary.
- Alchemy Agent Skills: https://www.alchemy.com/docs/alchemy-agent-skills.md
  - Recommends `npx skills add alchemyplatform/skills --yes`; offers `alchemy-api` (API key) and `agentic-gateway` (wallet/x402 payment) skills.

## Sanitized live WSS check

- Runtime loaded configured WSS URL from app config without printing it.
- `WebSocketProvider.getBlockNumber()` succeeded (reported latest block 12113062 in the check output).
- Seven marketplace contract event subscriptions were registered successfully.
- The command reported success before immediate teardown; immediate provider destruction then cancelled pending `eth_subscribe` cleanup, so rerun verification with orderly unsubscribe/close before claiming clean exit.
