import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { test } from 'node:test';
import { createIpRateLimiter } from '../../backend/middleware/ipRateLimiter';

function requestWithIp(ip: string) {
  return { ip, socket: { remoteAddress: ip } } as Request;
}

function responseRecorder() {
  let statusCode = 200;
  let body: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    }
  } as unknown as Response;
  return { response, status: () => statusCode, body: () => body };
}

test('IP rate limiter enforces request limits and bounds distinct client buckets', () => {
  const limiter = createIpRateLimiter(1, 60_000, 'Too many requests.', 1);
  const firstResponse = responseRecorder();
  let nextCalled = false;
  limiter(requestWithIp('client-a'), firstResponse.response, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  const repeatedResponse = responseRecorder();
  limiter(requestWithIp('client-a'), repeatedResponse.response, () => assert.fail('rate limit should block'));
  assert.equal(repeatedResponse.status(), 429);

  const capacityResponse = responseRecorder();
  limiter(requestWithIp('client-b'), capacityResponse.response, () => assert.fail('full limiter should reject new buckets'));
  assert.equal(capacityResponse.status(), 503);
  assert.deepEqual(capacityResponse.body(), {
    msg: 'Rate limiter capacity is temporarily exhausted.'
  });
});
