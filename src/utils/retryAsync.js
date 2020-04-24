const DELAY = 1000;

export async function retryAsync(retryCount, asyncFunc) {
  return new Promise((resolve, reject) => {

    asyncFunc(resolve, (err) => {
      if (retryCount <= 0) {
        reject(err);
      } else {

        setTimeout(() => {
          retryAsync(retryCount - 1, asyncFunc)
            .then(result => resolve(result))
            .catch(err => {
              if (err.message && JSON.stringify(err.message).indexOf('userRateLimitExceeded')) {
                setTimeout(() => {
                  reject(err);
                }, 10000);
              } else {
                reject(err);
              }
            });

        }, DELAY);

      }
    });

  });
}
