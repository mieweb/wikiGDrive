export interface CliParams {
  workdir: string;
  args: string[];
  debug: string[];

  client_id?: string;
  client_secret?: string;
  service_account?: string;
  server_port?: number;
  share_email?: string;
}
