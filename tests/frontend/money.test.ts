import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

interface PeerLoopMoney {
  toWei(value: string | number): bigint;
  fromWei(value: bigint, decimals?: number): string;
  formatEth(value: string | number, decimals?: number): string;
  sumEth(values: Array<string | number>): bigint;
  compareEth(left: string | number, right: string | number): number;
}

function loadMoneyHelpers(): PeerLoopMoney {
  const context = { window: {} as { PeerLoopMoney?: PeerLoopMoney } };
  const scriptPath = path.join(process.cwd(), 'frontend', 'dist', 'js', 'money.js');
  runInNewContext(readFileSync(scriptPath, 'utf8'), context);
  assert.ok(context.window.PeerLoopMoney);
  return context.window.PeerLoopMoney;
}

test('frontend money helpers preserve wei precision for parsing, sums, ordering, and display', () => {
  const money = loadMoneyHelpers();
  assert.equal(money.toWei('0.100000000000000001'), 100000000000000001n);
  assert.equal(
    money.fromWei(money.sumEth(['0.100000000000000001', '0.200000000000000002'])),
    '0.300000000000000003'
  );
  assert.equal(money.compareEth('0.100000000000000001', '0.1'), 1);
  assert.equal(money.formatEth('1.23456789'), '1.23456789');
  assert.equal(money.formatEth('0.000001'), '0.000001');
  assert.equal(money.formatEth('0.000000000000000001'), '0.000000000000000001');
  assert.equal(money.formatEth('1.000000000000000000'), '1');
  assert.throws(() => money.toWei('1.0000000000000000001'), /at most 18 places/);
});

test('money domain script loads before shared utilities and API-dependent feature scripts', () => {
  const { renderDocument } = require('../../frontend/src/document');
  const html = renderDocument(undefined, false);
  assert.ok(html.indexOf('/dist/js/money.js') < html.indexOf('/dist/js/utils.js'));
  assert.ok(html.indexOf('/dist/js/money.js') < html.indexOf('/dist/js/marketplace.js'));
});
