export class NotFoundError extends Error {
  code = 404;
}

export class AuthenticatedClient {

  async fetchApi(url, params = {}) {
    if (!params.headers) {
      params.headers = {};
    }

    params.headers['redirect-to'] = window.location.pathname;
    const response = await fetch(url, params);

    switch (response.status) {
      case 401:
        {
          const json = await response.json();
          if (json.authPath) {
            if (!window['authPopup']) {
              window['authPopup'] = window.open(json.authPath, '_blank', 'width=400,height=400,menubar=no,location=no,resizable=no,scrollbars=no,status=no')
              window['authenticated'] = (url) => {
                window['authPopup'].close();
                window['authPopup'] = null;
                window.location = url;
              };
            }
          }
        }
        throw new Error(url + ' ' + response.statusText);
      case 404:
        throw new NotFoundError(response.statusText);
    }

    return response;
  }
}
