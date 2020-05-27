import { assert } from 'chai';
import sinon from 'sinon';
import {QuotaLimiter} from '../src/google/QuotaLimiter';

var clock;

before(function () { clock = sinon.useFakeTimers(); });
after(function () { clock.restore(); });

describe('QuotaLimiterTest', () => {
  it('test sortLimits', async () => {
    const limiter = new QuotaLimiter();
    limiter.addLimit(5, 2);
    clock.tick(20 * 1000);
    limiter.addLimit(3, 1);
    clock.tick(20 * 1000);
    limiter.addLimit(5, 3);
    clock.tick(20 * 1000);
    limiter.addLimit(5, 1);

    assert.equal(limiter.limits[0].seconds, 1);
    assert.equal(limiter.limits[1].seconds, 1);
    assert.equal(limiter.limits[3].seconds, 3);
    assert.equal(limiter.limits[1].queries, 5);
  });

  it('test limiter', async () => {
    const limiter = new QuotaLimiter();
    limiter.addLimit(5, 1);

  });
});
