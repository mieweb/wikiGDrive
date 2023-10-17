import {LinkMode} from './model';

export interface CliParams {
  // link_mode: LinkMode; // TODO: remove ???
  workdir: string;
  // drive: string; // TODO: remove ???
  args: string[];
  debug: string[];

  client_id?: string;
  client_secret?: string;
  service_account?: string;
  server_port?: number;
  share_email?: string;
}
