import process from 'node:process';
import http from 'node:http';
import path from 'node:path';

import type {NextFunction, Request, Response} from 'express';
import express from 'express';
import winston from 'winston';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import compress from 'compression';

import {Container, ContainerConfig, ContainerEngine} from '../../ContainerEngine.ts';
import {saveRunningInstance} from './loadRunningInstance.ts';
import {urlToFolderId} from '../../utils/idParsers.ts';
import {GoogleDriveService} from '../../google/GoogleDriveService.ts';
import {FolderRegistryContainer} from '../folder_registry/FolderRegistryContainer.ts';
import {DriveJobsMap, initJob, JobManagerContainer} from '../job/JobManagerContainer.ts';
import GitController from './routes/GitController.ts';
import FolderController from './routes/FolderController.ts';
import {ConfigController} from './routes/ConfigController.ts';
import {DriveController} from './routes/DriveController.ts';
import {BackLinksController} from './routes/BackLinksController.ts';
import {GoogleDriveController} from './routes/GoogleDriveController.ts';
import {LogsController} from './routes/LogsController.ts';
import {PreviewController} from './routes/PreviewController.ts';

import {Socket, SocketManager} from './SocketManager.ts';

import {
  authenticate,
  GoogleUser,
  getAuth,
  authenticateOptionally,
  validateGetAuthState,
  handleDriveUiInstall, handleShare, handlePopupClose, redirError
} from './auth.ts';
import {filterParams} from '../../google/driveFetch.ts';
import {SearchController} from './routes/SearchController.ts';
import {DriveUiController} from './routes/DriveUiController.ts';
import {GoogleApiContainer} from '../google_api/GoogleApiContainer.ts';
import {UserAuthClient} from '../../google/AuthClient.ts';
import {getTokenInfo} from '../../google/GoogleAuthService.ts';
import {GoogleTreeProcessor} from '../google_folder/GoogleTreeProcessor.ts';
import {initStaticDistPages} from './static.ts';
import {initUiServer} from './vuejs.ts';
import {initErrorHandler} from './error.ts';
import { Buffer } from 'node:buffer';
import { Duplex } from 'node:stream';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const MAIN_DIR = __dirname + '/../../..';

function getDurationInMilliseconds(start: [number, number]) {
  const NS_PER_SEC = 1e9;
  const NS_TO_MS = 1e6;
  const diff = process.hrtime(start);

  return Math.round((diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS);
}

async function encodeWebSocketFrame(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
  let payload;
  let opcode;

  // Convert data to Buffer based on type
  if (typeof data === 'string') {
    payload = Buffer.from(data, 'utf8');
    opcode = 0x01; // Text frame
  } else if (data instanceof Blob) {
    const arrayBuffer = await data.arrayBuffer();
    payload = Buffer.from(arrayBuffer);
    opcode = 0x02; // Binary frame
  } else if (ArrayBuffer.isView(data) || data instanceof ArrayBuffer) {
    payload = Buffer.from(data);
    opcode = 0x02; // Binary frame
  } else {
    throw new Error('Unsupported data type');
  }

  const payloadLength = payload.length;
  let headerLength = 2; // Minimum header (FIN+opcode, payload length)
  let extendedLength = 0;

  // Determine header size based on payload length
  if (payloadLength >= 126 && payloadLength <= 65535) {
    headerLength += 2; // 16-bit length
    extendedLength = 126;
  } else if (payloadLength > 65535) {
    headerLength += 8; // 64-bit length
    extendedLength = 127;
  }

  // Create frame buffer
  const frame = Buffer.alloc(headerLength + payloadLength);

  // Set FIN bit (1) and opcode
  frame[0] = 0x80 | opcode; // FIN=1, opcode=0x01 or 0x02
  frame[1] = extendedLength || payloadLength; // Payload length or extended length flag

  // Write extended length if needed
  if (extendedLength === 126) {
    frame.writeUInt16BE(payloadLength, 2);
  } else if (extendedLength === 127) {
    frame.writeBigUInt64BE(BigInt(payloadLength), 2);
  }

  // Append payload
  payload.copy(frame, headerLength);

  return frame;
}

class DuplexToSocket implements Socket {
  private emitter = new EventTarget();
  private _closed: boolean = false;

  constructor(private duplex: Duplex) {
    this.duplex.addListener('end', () => {
      this._closed = true;
    });
    this.duplex.addListener('close', () => {
      this.emitter.dispatchEvent(new CloseEvent('close'));
      this._closed = true;
    });
    this.duplex.addListener('error', (err) => {
      this._closed = true;
    });

    this.duplex.addListener('data', (buffer: any) => {
      try {
        // Basic WebSocket frame parsing
        // const fin = (buffer[0] & 0x80) === 0x80;
        const opcode = buffer[0] & 0x0F;
        const hasMask = (buffer[1] & 0x80) === 0x80;
        let payloadLen = buffer[1] & 0x7F;
        let offset = 2;

        if (payloadLen === 126) {
          payloadLen = buffer.readUInt16BE(2);
          offset += 2;
        } else if (payloadLen === 127) {
          payloadLen = Number(buffer.readBigUInt64BE(2));
          offset += 8;
        }

        const maskingKey = hasMask ? buffer.slice(offset, offset + 4) : null;
        offset += hasMask ? 4 : 0;

        const payload = buffer.slice(offset, offset + payloadLen);
        let data = payload;

        // Unmask data if necessary
        if (hasMask) {
          data = Buffer.alloc(payloadLen);
          for (let i = 0; i < payloadLen; i++) {
            data[i] = payload[i] ^ maskingKey[i % 4];
          }
        }

        // https://datatracker.ietf.org/doc/html/rfc6455#section-11.8
        switch (opcode) {
          case 0x01: // Text Frame
          {
            // TODO
            const message = data.toString('utf8');
            console.warn(`Received: ${message}`);
          }
            break;

          case 0x08: // Connection Close Frame
            break;

          case 0x09: // Ping Frame
            // TODO
            console.warn('ping', data);
            break;

          default:
            console.warn('Unknown OPCODE', opcode, data);
        }

      } catch (error) {
        console.error('Error processing message:', error);
      }
      this.emitter.dispatchEvent(new MessageEvent('message')); // TODO
    });
  }

  addEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: Socket, ev: WebSocketEventMap[K]) => any): void {
    switch (type) {
      case 'close':
        this.emitter.addEventListener(type, () => {
          listener.call(this, new CloseEvent('close'));
        });
        break;
    }
  }

  async send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (this._closed) {
      return;
    }
    this.duplex.write(await encodeWebSocketFrame(data));
  }
}

export class ServerContainer extends Container {
  private logger!: winston.Logger;
  private authContainer!: Container;
  private socketManager!: SocketManager<DuplexToSocket>;

  constructor(params: ContainerConfig, private port: number) {
    super(params);
  }

  override async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename });
    this.authContainer = engine.getContainer('google_api');
    this.socketManager = new SocketManager(this.engine);
    await this.socketManager.mount(this.filesService);
    await saveRunningInstance(this.port);
  }

  private async startServer(port: number) {
    const app = express();

    app.use(express.json({
      limit: '50mb'
    }));
    app.use(express.text({
      limit: '50mb'
    }));
    app.use(cookieParser());

    app.use((req, res, next) => {
      res.header('GIT_SHA', process.env.GIT_SHA);
      // res.header('x-frame-options', 'ALLOW-FROM https://docs.google.com/');
      res.header('Content-Security-Policy', 'frame-ancestors \'self\' https://*.googleusercontent.com https://docs.google.com;');
      next();
    });

    if (express['addExpressTelemetry']) {
      express['addExpressTelemetry'](app);
    }

    app.use(rateLimit({
      validate: {
        xForwardedForHeader: false
      },
      windowMs: 60 * 1000,
      max: 3000
    }));

    app.use((req, res, next) => {
      res.header('wgd-share-email', this.params.share_email || '');
      next();
    });

    await this.initRouter(app);
    await this.initAuth(app);

    if (process.env.GIT_SHA === 'dev') {
      await initStaticDistPages(app);
      await initUiServer(app, this.logger);
    }

    app.use(express.static(path.resolve(MAIN_DIR, 'website', '.vitepress', 'dist'), { extensions: ['html'] }));
    app.use(express.static(path.resolve(MAIN_DIR, 'apps', 'ui', 'dist')));

    await initErrorHandler(app, this.logger);

    const server = http.createServer(app);

    server.on('upgrade', async (request: express.Request, socket: Duplex, head: Buffer) => {
      // Check for WebSocket upgrade request
      if (request.headers['upgrade'] !== 'websocket') {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }

      // Validate WebSocket key
      const key = request.headers['sec-websocket-key'];
      if (!key) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }

      const version = +(request.headers['sec-websocket-version'] || 0);
      if (version !== 13 && version !== 8) {
        const message = 'Missing or invalid Sec-WebSocket-Version header';
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n' + message);
        return;
      }

      if (!request.url || !request.url.startsWith('/api/')) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }

      const parts = request.url.split('/');
      if (!parts[2]) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }

      // Generate accept key per WebSocket protocol
      const arrayBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'));
      const acceptKey = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Send WebSocket handshake response
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
        '\r\n'
      );

      await this.socketManager.addSocketConnection(new DuplexToSocket(socket), parts[2]);
    });

    server.listen(port, () => {
      this.logger.info('Started server on port: ' + port);
    });
  }

  async initAuth(app) {
    app.use('/auth/logout', authenticateOptionally(this.logger));
    app.post('/auth/logout', async (req, res) => {
      if (req.user?.google_access_token) {
        const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
        await authClient.revokeToken(req.user.google_access_token);
      }

      res.clearCookie('accessToken');
      res.json({ loggedOut: true });
    });

    app.get('/auth/:driveId', async (req, res, next) => {
      try {
        const serverUrl = process.env.AUTH_DOMAIN || process.env.DOMAIN;
        const driveId = urlToFolderId(req.params.driveId);
        const redirectTo = req.query.redirectTo;
        const popupWindow = req.query.popupWindow;

        const state = new URLSearchParams(filterParams({
          driveId: driveId !== 'none' ? (driveId || '') : '',
          redirectTo,
          popupWindow: popupWindow === 'true' ? 'true' : '',
          instance: process.env.AUTH_INSTANCE
        })).toString();

        const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
        const authUrl = await authClient.getWebAuthUrl(`${serverUrl}/auth`, state);
        if (process.env.VERSION === 'dev') {
          console.debug(authUrl);
        }

        res.redirect(authUrl);
      } catch (err) {
        next(err);
      }
    });

    app.get('/auth', validateGetAuthState, handleDriveUiInstall, handleShare, handlePopupClose, (...args) => {
      getAuth.call(this, ...args);
    });

    app.use('/user/me', authenticateOptionally(this.logger));
    app.get('/user/me', async (req, res, next) => {
      try {
        if (!req.user || !req.user.google_access_token) {
          res.json({ user: undefined });
          return;
        }

        const tokenInfo = await getTokenInfo(req.user.google_access_token);

        if (!tokenInfo.expiry_date) {
          res.json({ user: undefined, tokenInfo });
          return;
        }

        const user: GoogleUser = {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
        };
        res.json({ user, tokenInfo });
      } catch (err) {
        next(err);
      }
    });
  }

  async initRouter(app) {
    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/')) {
        const start = process.hrtime();
        res.on('finish', () => {
          const durationInMilliseconds = getDurationInMilliseconds(start);
          this.logger.info(`${req.method} ${req.originalUrl} ${durationInMilliseconds}ms`);
        });
      }
      next();
    });

    app.use(compress());

    const driveController = new DriveController('/api/drive', this.filesService,
      <FolderRegistryContainer>this.engine.getContainer('folder_registry'), this.authContainer);
    app.use('/api/drive', authenticate(this.logger), await driveController.getRouter());

    const gitController = new GitController('/api/git', this.filesService,
      <JobManagerContainer>this.engine.getContainer('job_manager'), this.engine);
    app.use('/api/git', authenticate(this.logger), await gitController.getRouter());

    const folderController = new FolderController('/api/file', this.filesService, this.engine);
    app.use('/api/file', authenticate(this.logger), await folderController.getRouter());

    const googleDriveController = new GoogleDriveController('/api/gdrive', this.filesService);
    app.use('/api/gdrive', authenticate(this.logger), await googleDriveController.getRouter());

    const backlinksController = new BackLinksController('/api/backlinks', this.filesService);
    app.use('/api/backlinks', authenticate(this.logger), await backlinksController.getRouter());
    // app.get('/api/backlinks/:driveId/:fileId', async (req: Request, res: Response) => { TODO
    //   const { backlinks, links } = backlinksController.getBackLinks();
    // });

    const configController = new ConfigController('/api/config', this.filesService, <FolderRegistryContainer>this.engine.getContainer('folder_registry'), this.engine);
    app.use('/api/config', authenticate(this.logger), await configController.getRouter());

    const logsController = new LogsController('/api/logs', this.logger);
    app.use('/api/logs', authenticate(this.logger), await logsController.getRouter());

    const searchController = new SearchController('/api/search', this.filesService);
    app.use('/api/search', authenticate(this.logger), await searchController.getRouter());

    const previewController = new PreviewController('/preview', this.logger);
    app.use('/preview', authenticate(this.logger), await previewController.getRouter());

    const driveUiController = new DriveUiController('/driveui', this.logger, this.filesService, <GoogleApiContainer>this.authContainer);
    app.use('/driveui', await driveUiController.getRouter());

    app.use('/api/share-token', authenticate(this.logger), (req, res) => {
      if ('POST' !== req.method) {
        throw new Error('Incorrect method');
      }
      if (req.user) {
        const { google_access_token } = req.user;
        if (google_access_token) {
          res.json({ google_access_token, share_email: this.params.share_email });
          return;
        }
      }
      res.json({});
    });

    app.get('/api/ps', async (req, res, next) => {
      try {
        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        const driveJobsMap: DriveJobsMap = await jobManagerContainer.ps();

        const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
        const folders = await folderRegistryContainer.getFolders();

        const retVal = [];
        for (const folderId in folders) {
          const driveJobs = driveJobsMap[folderId] || { jobs: [] };
          const folder = folders[folderId];
          retVal.push({
            folderId, name: folder.name, jobs_count: driveJobs.jobs.length
          });
        }

        res.json(retVal);
      } catch (err) {
        next(err);
      }
    });

    app.post('/api/run_action/:driveId/:action_id', authenticate(this.logger, 2), async (req, res, next) => {
      try {
        const driveId = urlToFolderId(req.params.driveId);

        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        await jobManagerContainer.schedule(driveId, {
          ...initJob(),
          type: 'run_action',
          title: 'Run action: ' + req.params.action_id,
          action_id: req.params.action_id,
          payload: req.body ? JSON.stringify(req.body) : '',
          user: req.user
        });

        res.json({ driveId });
      } catch (err) {
        next(err);
      }
    });

    app.post('/api/sync/:driveId', authenticate(this.logger, 2), async (req, res, next) => {
      try {
        const driveId = urlToFolderId(req.params.driveId);

        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        await jobManagerContainer.schedule(driveId, {
          ...initJob(),
          type: 'sync_all',
          title: 'Syncing all'
        });

        res.json({ driveId });
      } catch (err) {
        next(err);
      }
    });

    app.post('/api/sync/:driveId/:fileId', authenticate(this.logger, 2), async (req, res, next) => {
      try {
        const driveId = urlToFolderId(req.params.driveId);
        const fileId = req.params.fileId;

        let fileTitle = '#' + fileId;

        const driveFileSystem = await this.filesService.getSubFileService(driveId, '');
        const googleTreeProcessor = new GoogleTreeProcessor(driveFileSystem);
        await googleTreeProcessor.load();
        const [file, drivePath] = await googleTreeProcessor.findById(fileId);
        if (file && drivePath) {
          fileTitle = file['name'];
        }

        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        await jobManagerContainer.schedule(driveId, {
          ...initJob(),
          type: 'sync',
          payload: fileId,
          title: 'Syncing file: ' + fileTitle
        });

        res.json({ driveId, fileId });
      } catch (err) {
        next(err);
      }
    });

    app.get('/api/inspect/:driveId', authenticate(this.logger, 2), async (req, res, next) => {
      try {
        const driveId = urlToFolderId(req.params.driveId);
        const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
        const inspected = await jobManagerContainer.inspect(driveId);

        const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
        const folders = await folderRegistryContainer.getFolders();
        inspected['folder'] = folders[driveId];
        res.json(inspected);
      } catch (err) {
        next(err);
      }
    });

    app.post('/api/share_drive', authenticate(this.logger, -1), async (req, res, next) => {
      try {
        const folderUrl = req.body.url;
        const driveId = urlToFolderId(folderUrl);

        if (!driveId) {
          throw new Error('No DriveId');
        }

        if (!req.user?.google_access_token) {
          throw redirError(req, 'Not authenticated');
        }

        const googleDriveService = new GoogleDriveService(this.logger, null);
        const drive = await googleDriveService.getDrive(req.user.google_access_token, driveId);

        const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
        const folder = await folderRegistryContainer.registerFolder(drive.id);

        res.json(folder);
      } catch (err) {
        next(err);
      }
    });
  }

  async run() {
    await this.startServer(this.port);
  }

}
