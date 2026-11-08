import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const artifactPath = path.join(process.cwd(), 'smart-contract', 'artifacts', 'contracts', 'Marketplace.sol', 'Marketplace.json');
const browserAbiPath = path.join(process.cwd(), 'frontend', 'dist', 'js', 'contracts', 'marketplaceAbi.js');
const listenerPath = path.join(process.cwd(), 'backend', 'contractListener.ts');
const { Interface } = require('ethers');

function loadArtifactAbi(): unknown[] {
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as { abi?: unknown[] };
  assert.ok(Array.isArray(artifact.abi), 'Compiled Marketplace artifact must contain an ABI array.');
  return artifact.abi;
}

test('browser ABI is synchronized with the compiled Marketplace artifact', () => {
  const context = {};
  runInNewContext(readFileSync(browserAbiPath, 'utf8'), context);
  const browserAbi = runInNewContext('marketplaceABI', context) as unknown[];
  assert.deepEqual(JSON.parse(JSON.stringify(browserAbi)), loadArtifactAbi());
});

test('backend listener event fragments exist in the canonical Marketplace ABI', () => {
  const listenerSource = readFileSync(listenerPath, 'utf8');
  const declaration = listenerSource.match(/const MARKETPLACE_ABI\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(declaration, 'Backend listener ABI declaration should remain discoverable.');
  const eventFragments = [...declaration[1].matchAll(/'event\s+([^']+)'/g)]
    .map(([, fragment]) => `event ${fragment}`);
  assert.ok(eventFragments.length > 0, 'Backend listener should declare at least one event.');

  const canonicalInterface = new Interface(loadArtifactAbi());
  const listenerInterface = new Interface(eventFragments);
  for (const fragment of listenerInterface.fragments) {
    if (fragment.type !== 'event') continue;
    assert.ok(
      canonicalInterface.getEvent(fragment.format('sighash')),
      `Backend event ${fragment.format('sighash')} is missing from the canonical ABI.`
    );
  }
});
