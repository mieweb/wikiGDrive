import AuthModal from '../components/AuthModal.vue';

export class NotFoundError extends Error {
  code = 404;
}

export class AuthenticatedClient {

  constructor(app) {
    this.app = app;
  }

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
            this.app.$root.$addModal({
              component: AuthModal,
              props: {
                authPath: json.authPath
              },
            });
          }
        }
        throw new Error(url + ' ' + response.statusText);
      case 404:
        throw new NotFoundError(response.statusText);
      case 501:
        if ((response.headers.get('Content-type') || '').startsWith('text/plain')) {
          throw new Error(await response.text());
        }
    }

    return response;
  }
}
