const DELAY = 1000;

export async function retryAsync(retryCount, asyncFunc) {
  return new Promise((resolve, reject) => {

    const handleError = (err) => {
      if (retryCount <= 0) {
        reject(err);
      } else {

        setTimeout(() => {
          retryAsync(retryCount - 1, asyncFunc)
            .then(result => resolve(result))
            .catch(err => {
              if (err.isQuotaError) {
                setTimeout(() => {
                  reject(err);
                }, 10000);
              } else {
                reject(err);
              }
            });

        }, DELAY);

      }
    };

    try {
      asyncFunc(resolve, (err) => handleError(err));
    } catch (err) {
      handleError(err);
    }

  });
}
