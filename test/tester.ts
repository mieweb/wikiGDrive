/** @typedef {import('ava').TestFn} AvaTestFn */

// @ts-ignore Custom cast
export default await (async () => {
  if ('Deno' in globalThis) {
    const denoAsserts = await import('https://deno.land/std@0.178.0/testing/asserts.ts');
    /**
     *
     * @param {string} title
     * @param {import('ava').ImplementationFn<any, any>} implementation
     */
    // eslint-disable-next-line no-inner-declarations
    function test(title, implementation) {
      Deno.test(title, async (t) => {
        /** @type {import('ava').ExecutionContext} T */
        const wrapper = {
          timeout(ms) {

          },
          assert: denoAsserts.assertStrictEquals,
          deepEqual: denoAsserts.assertEquals,
          // like
          fail: denoAsserts.fail,
          false(actual, message) {
            denoAsserts.assertStrictEquals(actual, false, message);
            return true;
          },
          falsy(actual, message) {
            denoAsserts.assertStrictEquals(!actual, true, message);
            return true;
          },
          is: denoAsserts.assertStrictEquals,
          not(actual, expected) {
            denoAsserts.assertStrictEquals(!Object.is(actual, expected), true);
          },
          notDeepEqual: denoAsserts.assertNotEquals,
          notRegex: denoAsserts.notMatch,
          notThrows(fn, message) {
            try {
              fn();
            } catch {
              this.fail(message);
            }
          },
          async notThrowsAsync(fn, message) {
            try {
              await fn();
            } catch {
              this.fail(message);
            }
          },
          pass(message) {
            denoAsserts.assert(true, message);
          },
          regex: denoAsserts.assertMatch,
          // snapshot
          throws: denoAsserts.assertThrows,
          async throwsAsync(fn, expectations, message) {
            try {
              await fn();
              this.fail(message);
            } catch (e) {
              this.throws(() => { throw e; }, expectations, message);
            }
          },
          true(actual, message) {
            denoAsserts.assertStrictEquals(actual, true, message);
          },
          truthy(actual, message) {
            denoAsserts.assert(actual, message);
          },
          log: console.debug,
        };
        await implementation(wrapper);
      });
    }
    return test;
  }
  if ('window' in globalThis) {
    // TODO: Tap into browser-based tester
    return null;
  }
  // Node
  const ava = await import('ava');
  return ava.default;
})();
