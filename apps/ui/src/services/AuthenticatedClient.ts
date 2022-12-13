import AuthModal from '../components/AuthModal.vue';
import {markRaw} from 'vue';

export class NotFoundError extends Error {
  code = 404;
  public readonly share_email: string;
  constructor(msg, params) {
    super(msg);
    this.share_email = params.share_email;
  }
}

export class ResponseError extends Error {
  public readonly json: any;
  public readonly status: any;
  constructor(message, status, json) {
    super(message);
    this.json = json;
    this.status = status;
  }
}

export class AuthenticatedClient {
  private app: any;
  private lastGetResponses: any;
  private GIT_SHA: string;
  public isLogged: boolean;

  constructor(app) {
    this.app = app;
    this.lastGetResponses = {};
    this.isLogged = false;
  }

  async fetchApi(url, params: any = {}) {
    const now = +new Date();

    const isGet = Object.keys(params).length === 0;
/*
    if (isGet && this.lastGetReponses[url]) {
      if (now - this.lastGetReponses[url].ts < 1000) {
        return this.lastGetReponses[url].response;
      } else {
        delete this.lastGetReponses[url];
      }
    }
*/

    if (!params.headers) {
      params.headers = {};
    }

    params.headers['redirect-to'] = window.location.pathname;
    const response = await fetch(url, params);

    this.GIT_SHA = response.headers.get('GIT_SHA');
    const share_email = response.headers.get('wgd-share-email');
    this.isLogged = !!response.headers.get('wgd-is-logged');

    switch (response.status) {
      case 401:
      case 403:
        {
          if (params.optional_login) {
            return {
              json: async () => ([])
            };
          }

          const json = await response.json();
          if (json.authPath) {
            this.app.$root.$addModal({
              component: markRaw(AuthModal),
              props: {
                authPath: json.authPath
              },
            });
          }
          throw new ResponseError(url + ' ' + response.statusText, response.status, json);
        }
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
        const text = await response.text();
        response.json = async () => {
          try {
            return JSON.parse(text);
          } catch (err) {
            throw new Error('Error parsing JSON: ' + text);
          }
        };
        response.text = async () => text;
      }
      this.lastGetResponses[url] = {
        ts: now,
        response
      };
    }

    return response;
  }
}
