import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

interface ActivityRecord {
  _id: string;
  escrowId?: string | null;
  escrowState?: number;
  refunded?: boolean;
  blockNumber?: number;
}

interface AccountDashboardApi {
  getActivityRecords(
    history: { purchased: ActivityRecord[]; sold: ActivityRecord[] },
    view: string
  ): ActivityRecord[];
  shouldAutoOpenDisputeEscrow(
    hasSellerDispute: boolean,
    selectedView: string,
    manuallySelected: boolean
  ): boolean;
  getDisputeVoteView(
    votes: number,
    isBuyer: boolean
  ): {
    myVote: 'release' | 'refund' | null;
    otherVote: 'release' | 'refund' | null;
    choices: Array<'release' | 'refund'>;
  };
  shouldRefreshProfileHistory(hasCachedHistory: boolean, lastUpdatedAt: number, now?: number): boolean;
}

function loadAccountDashboardApi(): AccountDashboardApi {
  const windowObject: { PeerLoopAccount?: AccountDashboardApi } = {};
  const documentObject = {
    getElementById: () => ({ addEventListener: () => {} }),
    querySelectorAll: () => []
  };
  const scriptPath = path.join(process.cwd(), 'frontend', 'dist', 'js', 'accountDashboard.js');
  runInNewContext(readFileSync(scriptPath, 'utf8'), {
    window: windowObject,
    document: documentObject
  });
  assert.ok(windowObject.PeerLoopAccount);
  return windowObject.PeerLoopAccount;
}

test('disputed seller sales remain visible in sold history and respect manual tab selection', () => {
  const dashboard = loadAccountDashboardApi();
  const disputedSale = { _id: '7', escrowId: '12', escrowState: 4 };
  const completedSale = { _id: '8', escrowId: '13', escrowState: 2 };
  const purchase = { _id: '9', escrowId: '14', escrowState: 1 };
  const history = {
    sold: [disputedSale, completedSale],
    purchased: [purchase]
  };

  assert.deepEqual(
    Array.from(dashboard.getActivityRecords(history, 'sold'), item => item._id),
    ['7', '8']
  );
  assert.deepEqual(
    Array.from(dashboard.getActivityRecords(history, 'escrow'), item => item._id),
    ['9', '7']
  );
  disputedSale.escrowState = 2;
  assert.deepEqual(
    Array.from(dashboard.getActivityRecords(history, 'sold'), item => item._id),
    ['7', '8']
  );
  assert.deepEqual(
    Array.from(dashboard.getActivityRecords(history, 'escrow'), item => item._id),
    ['9']
  );
  assert.equal(dashboard.shouldAutoOpenDisputeEscrow(true, 'sold', false), true);
  assert.equal(dashboard.shouldAutoOpenDisputeEscrow(true, 'purchased', false), true);
  assert.equal(dashboard.shouldAutoOpenDisputeEscrow(true, 'sold', true), false);
  assert.equal(dashboard.shouldAutoOpenDisputeEscrow(true, 'purchased', true), false);
  assert.equal(dashboard.shouldRefreshProfileHistory(true, 1000, 10000), false);
  assert.equal(dashboard.shouldRefreshProfileHistory(true, 1000, 32000), true);
  assert.equal(dashboard.shouldRefreshProfileHistory(false, 1000, 2000), true);
});

test('dispute vote view shows both available choices regardless of the other party vote', () => {
  const dashboard = loadAccountDashboardApi();

  assert.deepEqual(
    JSON.parse(JSON.stringify(dashboard.getDisputeVoteView(0, true))),
    { myVote: null, otherVote: null, choices: ['release', 'refund'] }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(dashboard.getDisputeVoteView(8, true))),
    { myVote: null, otherVote: 'release', choices: ['release', 'refund'] }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(dashboard.getDisputeVoteView(2, true))),
    { myVote: 'release', otherVote: null, choices: ['release', 'refund'] }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(dashboard.getDisputeVoteView(6, true))),
    { myVote: 'release', otherVote: 'refund', choices: ['release', 'refund'] }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(dashboard.getDisputeVoteView(6, false))),
    { myVote: 'refund', otherVote: 'release', choices: ['release', 'refund'] }
  );
});

test('escrow dashboard no longer exposes fulfillment or timeout actions', () => {
  const scriptPath = path.join(process.cwd(), 'frontend', 'dist', 'js', 'accountDashboard.js');
  const dashboardScript = readFileSync(scriptPath, 'utf8');

  for (const removedFeature of [
    'Submit fulfillment evidence',
    'refundForNonFulfillment',
    'escalateUnansweredEscrow',
    'finalizeDisputeTimeout',
    'Fulfillment claim submitted'
  ]) {
    assert.equal(dashboardScript.includes(removedFeature), false, `${removedFeature} should not be present`);
  }
});
