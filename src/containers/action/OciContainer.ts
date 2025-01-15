import {Writable} from 'node:stream';

export interface OciContainer {
  skipMount: boolean;

  start(): Promise<void>;
  copy(localPath: string, remotePath: string): Promise<void>;
  putFile(uint8Array: Uint8Array, remotePath: string): Promise<void>;
  export(remotePath: string, localPath: string): Promise<void>;
  exec(command: string, env: { [p: string]: string }, writable: Writable): Promise<number>;
  stop(): Promise<void>;
}
