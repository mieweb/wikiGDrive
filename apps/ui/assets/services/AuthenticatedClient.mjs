import AuthModal from '../components/AuthModal.vue';
import {markRaw} from 'vue';

export class NotFoundError extends Error {
  code = 404;
  constructor(msg, params) {
    super(msg);
    this.share_email = params.share_email;
  }
}

export class AuthenticatedClient {

  constructor(app) {
    this.app = app;
    this.lastGetReponses = {};
  }

  async fetchApi(url, params = {}) {
    const now = +new Date();

    const isGet = Object.keys(params).length === 0;
    if (isGet && this.lastGetReponses[url]) {
      if (now - this.lastGetReponses[url].ts < 1000) {
        return this.lastGetReponses[url].response;
      } else {
        delete this.lastGetReponses[url];
      }
    }

    if (!params.headers) {
      params.headers = {};
    }

    params.headers['redirect-to'] = window.location.pathname;
    const response = await fetch(url, params);

    this.GIT_SHA = response.headers.get('GIT_SHA');
    const share_email = response.headers.get('wgd-share-email');

    switch (response.status) {
      case 401:
        {
          const json = await response.json();
          if (json.authPath) {
            this.app.$root.$addModal({
              component: markRaw(AuthModal),
              props: {
                authPath: json.authPath
              },
            });
          }
        }
        throw new Error(url + ' ' + response.statusText);
      case 404:
        throw new NotFoundError(response.statusText, { share_email });
      case 501:
        if ((response.headers.get('Content-type') || '').startsWith('text/plain')) {
          throw new Error(await response.text());
        }
    }

    if (isGet) {
      const contentTYpe = (response.headers.get('Content-type') || '');
      if (contentTYpe.startsWith('application/json') || contentTYpe.startsWith('application/vnd.google-apps.folder')) {
        const json = await response.json();
        response.json = async () => json;
      }
      this.lastGetReponses[url] = {
        ts: now,
        response
      }
    }

    return response;
  }
}
