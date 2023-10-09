import {FileContentService} from '../utils/FileContentService';
import {AuthConfig} from '../model/AccountJson';

interface Params {
  client_id?: string;
  client_secret?: string;
  service_account?: string;
}

export async function getAuthConfig(params: Params, mainFileService: FileContentService): Promise<AuthConfig> {
  if (params.service_account) {
    const rootFileService = new FileContentService('/');
    return {
      service_account: await rootFileService.readJson(params.service_account)
    };
  } else
  if (params.client_id && params.client_secret) {
    return {
      user_account: {
        type: 'user_account',
        client_id: params.client_id,
        client_secret: params.client_secret
      }
    };
  } else {
    const authConfig = await mainFileService.readJson('auth_config.json');
    if (!authConfig) {
      throw new Error('No authentication credentials provided');
    }
    return authConfig;
  }
}
