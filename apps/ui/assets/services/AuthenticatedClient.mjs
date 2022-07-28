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
          window.location = json.authPath;
        }
    }

    return response;
  }

}
