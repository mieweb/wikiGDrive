import sinon from 'sinon';

var clock;

before(function () { clock = sinon.useFakeTimers(); });
after(function () { clock.restore(); });

describe('QuotaLimiterTest', () => {
});
