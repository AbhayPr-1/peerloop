import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

interface TestApiClient {
  baseUrl: string;
  auth: {
    createChallenge(walletAddress: string): Promise<{ message: string }>;
    signIn(walletAddress: string, signature: string): Promise<{ user: { id: string; name: string; walletAddress: string } }>;
  };
  uploads: {
    uploadImage(file: File): Promise<{ imageUrl: string; ipfsHash: string }>;
  };
}

const clientScriptPath = path.join(process.cwd(), 'frontend', 'dist', 'js', 'apiClient.js');
const transportScriptPath = path.join(process.cwd(), 'frontend', 'dist', 'js', 'apiTransport.js');

function loadApiClient(fetchImplementation: typeof fetch, configuredUrl = 'https://api.peerloop.test/'): TestApiClient {
  const windowObject = {
    location: { hostname: 'peerloop.test', origin: 'https://peerloop.test' },
    PEERLOOP_API_URL: undefined as string | undefined,
    PeerLoopApi: undefined as TestApiClient | undefined
  };
  const documentObject = {
    querySelector: (selector: string) => selector === 'meta[name="peerloop-api-url"]'
      ? { getAttribute: () => configuredUrl }
      : null
  };
  const source = readFileSync(clientScriptPath, 'utf8');
  const context = {
    window: windowObject,
    document: documentObject,
    fetch: fetchImplementation,
    AbortController,
    FormData,
    URL,
    setTimeout,
    clearTimeout
  };
  runInNewContext(readFileSync(transportScriptPath, 'utf8'), context);
  runInNewContext(source, context);
  assert.ok(windowObject.PeerLoopApi);
  return windowObject.PeerLoopApi;
}

test('frontend API client normalizes base URL and sends auth JSON with cookie credentials', async () => {
  const calls: Array<{ url: string; options: RequestInit }> = [];
  const api = loadApiClient(async (input, init = {}) => {
    calls.push({ url: String(input), options: init });
    return new Response(JSON.stringify({ message: 'sign this challenge' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });

  assert.equal(api.baseUrl, 'https://api.peerloop.test');
  const challenge = await api.auth.createChallenge('0x123');
  assert.equal(challenge.message, 'sign this challenge');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.peerloop.test/api/auth/nonce');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.credentials, 'include');
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), { walletAddress: '0x123' });
});

test('frontend API client keeps multipart uploads and surfaces backend error messages', async () => {
  const calls: Array<{ url: string; options: RequestInit }> = [];
  let responseBody: { imageUrl: string; ipfsHash: string } | { msg: string } = {
    imageUrl: 'ipfs://bafy-test', ipfsHash: 'bafy-test'
  };
  let responseStatus = 200;
  const api = loadApiClient(async (input, init = {}) => {
    calls.push({ url: String(input), options: init });
    return new Response(JSON.stringify(responseBody), {
      status: responseStatus,
      headers: { 'Content-Type': 'application/json' }
    });
  });

  const image = new Blob(['image-bytes'], { type: 'image/png' }) as File;
  const uploaded = await api.uploads.uploadImage(image);
  assert.equal(uploaded.imageUrl, 'ipfs://bafy-test');
  assert.equal(calls[0].url, 'https://api.peerloop.test/api/upload');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.credentials, 'include');
  assert.ok(calls[0].options.body instanceof FormData);
  assert.equal((calls[0].options.body as FormData).get('productImage') instanceof Blob, true);
  assert.equal(calls[0].options.headers, undefined);

  responseBody = { msg: 'Request origin is not allowed.' };
  responseStatus = 403;
  await assert.rejects(api.auth.signIn('0x123', 'signature'), (error: { name: string; message: string; status: number }) => {
    assert.equal(error.name, 'PeerLoopApiError');
    assert.equal(error.message, 'Request origin is not allowed.');
    assert.equal(error.status, 403);
    return true;
  });
});

test('marketplace ABI script loads before contract runtime and retains required event definitions', () => {
  const browserContext = {
    window: { ethereum: undefined, location: { reload() {} } }
  };
  const abiPath = path.join(process.cwd(), 'frontend', 'dist', 'js', 'contracts', 'marketplaceAbi.js');
  const contractPath = path.join(process.cwd(), 'frontend', 'dist', 'js', 'contract.js');
  runInNewContext(readFileSync(abiPath, 'utf8'), browserContext);
  runInNewContext(readFileSync(contractPath, 'utf8'), browserContext);
  const eventNames = runInNewContext(
    "marketplaceABI.filter(item => item.type === 'event').map(item => item.name)",
    browserContext
  ) as string[];
  assert.deepEqual(JSON.parse(JSON.stringify(eventNames)).sort(), [
    'ProductDeleted', 'ProductListed', 'ProductSold', 'EscrowCreated', 'EscrowReleased',
    'EscrowRefunded', 'EscrowDisputed', 'EscrowResolutionVoted', 'PaymentWithdrawn'
  ].sort());
  const functionNames = runInNewContext(
    "marketplaceABI.filter(item => item.type === 'function').map(item => item.name)",
    browserContext
  ) as string[];
  assert.ok(functionNames.includes('getForSaleProductsPage'));
  assert.ok(functionNames.includes('escrowHistory'));
  assert.ok(functionNames.includes('disputeEscrow'));
  assert.ok(functionNames.includes('voteDisputeResolution'));
  assert.ok(functionNames.includes('disputeResolutionVotes'));
  assert.ok(functionNames.includes('releaseEscrow'));
  assert.ok(functionNames.includes('refundEscrow'));
  assert.equal(functionNames.includes('resolveDispute'), false);
  assert.equal(functionNames.includes('arbitrator'), false);
  assert.ok(functionNames.includes('pendingWithdrawals'));
  assert.ok(functionNames.includes('withdrawPayments'));
  assert.equal(functionNames.includes('buyProduct'), false);
  assert.equal(functionNames.includes('owner'), false);

  const { renderDocument } = require('../../frontend/src/document');
  const html = renderDocument(undefined, false);
  assert.ok(html.indexOf('<script type="module" src="/dist/app.js"></script>') < html.indexOf('<script defer src="js/ethers.umd.min.js"></script>'));
  assert.ok([...html.matchAll(/<script\b(?![^>]*type="module")[^>]*src="[^"]+"[^>]*>/g)]
    .every(([tag]) => /\bdefer\b/.test(tag)));
  assert.ok(html.indexOf('/dist/js/apiTransport.js') < html.indexOf('/dist/js/apiClient.js'));
  assert.ok(html.indexOf('/dist/js/contracts/marketplaceAbi.js') < html.indexOf('/dist/js/contract.js'));
});
