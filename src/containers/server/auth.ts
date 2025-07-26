import process from 'node:process';

import jsonwebtoken from 'jsonwebtoken';
import type {NextFunction, Request, Response} from 'express';
import {Logger} from 'winston';
import {decrypt, encrypt} from '../../google/GoogleAuthService.ts';
import {GoogleDriveService} from '../../google/GoogleDriveService.ts';
import {UserAuthClient} from '../../google/AuthClient.ts';
import {FolderRegistryContainer} from '../folder_registry/FolderRegistryContainer.ts';
import {urlToFolderId} from '../../utils/idParsers.ts';
import {initJob, JobManagerContainer} from '../job/JobManagerContainer.ts';

export class AuthError extends Error {
  public status: number;
  public authPath = '';
  public redirectTo = '';
  public showHtml = false;
  constructor(msg: string, status: number) {
    super(msg);
    this.status = status;
  }
}

export function redirError(req: Request, msg: string) {
  const err = new AuthError(msg + ' for: ' + req.originalUrl, 401);
  const [, driveId] = req.path.split('/');

  const redirectTo: string = req.headers['redirect-to'] ? req.headers['redirect-to'].toString() : '';
  if (redirectTo && redirectTo.startsWith('/') && redirectTo.indexOf('//') === -1) {
    err.redirectTo = redirectTo;
  } else {
    err.redirectTo = '/drive/' + (driveId || '');
  }
  if (driveId) {
    err.authPath = '/auth/' + driveId + '?redirectTo=' + err.redirectTo;
  } else {
    err.authPath = '/auth/none?redirectTo=' + err.redirectTo;
  }

  return err;
}

export interface GoogleUser {
  id: string;
  name: string;
  email: string;
}

interface JwtEncryptedPayload {
  sub: string; // userId
  name: string;
  email: string;
  gat: string;
  grt: string;
  ged: number;
  driveId: string;
}

interface JwtDecryptedPayload extends GoogleUser {
  google_access_token: string;
  google_refresh_token: string;
  google_expiry_date: number;
  driveId: string;
}

async function signToken(payload: JwtDecryptedPayload, jwtSecret: string): Promise<string> {
  const expiresIn = 365 * 24 * 3600;

  const encrypted: JwtEncryptedPayload = {
    sub: payload.id,
    name: payload.name,
    email: payload.email,
    gat: await encrypt(payload.google_access_token, jwtSecret),
    grt: payload.google_refresh_token ? await encrypt(payload.google_refresh_token, jwtSecret) : undefined,
    ged: payload.google_expiry_date,
    driveId: payload.driveId
  };

  return jsonwebtoken.sign(encrypted, jwtSecret, { expiresIn });
}

async function verifyToken(accessCookie: string, jwtSecret: string): Promise<JwtDecryptedPayload> {
  const encrypted: JwtEncryptedPayload = <JwtEncryptedPayload>jsonwebtoken.verify(accessCookie, jwtSecret);

  return {
    id: encrypted.sub,
    name: encrypted.name,
    email: encrypted.email,
    google_access_token: await decrypt(encrypted.gat, process.env.JWT_SECRET),
    google_refresh_token: encrypted.grt ? await decrypt(encrypted.grt, process.env.JWT_SECRET) : undefined,
    google_expiry_date: encrypted.ged,
    driveId: encrypted.driveId
  };
}

function openerRedirect(res: Response, redirectTo: string) {
  res.send(`<script>window.opener.authenticated('${redirectTo}');window.close();</script>`);
}

export function validateGetAuthState(req: Request, res: Response, next) {
  if (!req.query.state) {
    const wantsHTML = req.accepts('html', 'json') === 'html';
    if (wantsHTML) {
      throw new AuthError('Redirect to homepage', 302);
    } else {
      throw redirError(req, 'No state query parameter');
    }
  }
  next();
}

export async function handleDriveUiInstall(req: Request, res: Response, next) {
  try {
    const serverUrl = process.env.AUTH_DOMAIN || process.env.DOMAIN;

    const state = new URLSearchParams(req.query.state.toString());
    const driveui = urlToFolderId(state.get('driveui'));
    if (driveui) {
      const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
      await authClient.authorizeResponseCode(req.query.code.toString(), `${serverUrl}/auth`);
      res.redirect('/driveui/installed');
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export async function handleShare(req: Request, res: Response, next: NextFunction) {
  try {
    const serverUrl = process.env.AUTH_DOMAIN || process.env.DOMAIN;

    const state = new URLSearchParams(req.query.state.toString());
    const shareId = urlToFolderId(state.get('shareId'));
    if (shareId) {
      const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
      await authClient.authorizeResponseCode(req.query.code.toString(), `${serverUrl}/auth`);
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

export async function handlePopupClose(req: Request, res: Response, next: NextFunction) {
  try {
    const state = new URLSearchParams(req.query.state.toString());
    if (!process.env.AUTH_INSTANCE) { // main auth host
      const instance = state.get('instance');
      if (instance && instance.match(/^pr-\d+$/)) {
        next();
        return;
      }
    }

    if (state.get('popupWindow') === 'true') {
      openerRedirect(res, req.url.replace('popupWindow', ''));
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

function sanitizeRedirect(redirectTo: string) {
  if ((redirectTo || '').startsWith('/gdocs/')) {
    const [folderId, fileId] = redirectTo.substring('/gdocs/'.length).split('/');
    if (folderId.match(/^[A-Z0-9_-]+$/ig) && fileId.match(/^[A-Z0-9_-]+$/ig)) {
      return `/gdocs/${folderId}/${fileId}`;
    }
  }

  const folderId = urlToFolderId(redirectTo);

  if (!folderId) {
    return '';
  }

  return `/drive/${folderId}`;
}

export async function getAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const serverUrl = process.env.AUTH_DOMAIN || process.env.DOMAIN;

    const state = new URLSearchParams(req.query.state.toString());

    if (!process.env.AUTH_INSTANCE) { // main auth host
      const instance = state.get('instance');
      if (instance && instance.match(/^pr-\d+$/)) {
        res.redirect(`https://${instance}.wikigdrive.com${req.originalUrl}`);
        return;
      }
    }

    const driveId = urlToFolderId(state.get('driveId'));
    const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');

    const shareDrive = !!state.get('shareDrive');
    if (driveId && shareDrive) {
      const googleDriveService = new GoogleDriveService(this.logger, null);
      const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
      await authClient.authorizeResponseCode(req.query.code.toString(), `${serverUrl}/auth`);

      await googleDriveService.shareDrive(await authClient.getAccessToken(), driveId, this.params.share_email);

      await folderRegistryContainer.registerFolder(driveId);
      res.redirect('/drive/' + driveId);
      return;
    }

    const uploadDrive = !!state.get('uploadDrive');
    if (driveId && uploadDrive) {
      const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
      await authClient.authorizeResponseCode(req.query.code.toString(), `${serverUrl}/auth`);

      const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
      await jobManagerContainer.schedule(driveId, {
        ...initJob(),
        type: 'upload',
        title: 'Uploading to Google Drive',
        access_token: await authClient.getAccessToken()
      });

      res.redirect('/drive/' + driveId);
      return;
    }

    if (driveId && !folderRegistryContainer.hasFolder(driveId)) {
      const err = new AuthError('Folder not registered', 404);
      err.showHtml = true;
      throw err;
    }
    const redirectTo = sanitizeRedirect(state.get('redirectTo'));

    const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
    await authClient.authorizeResponseCode(req.query.code.toString(), `${serverUrl}/auth`);
    const googleDriveService = new GoogleDriveService(this.logger, null);
    const googleUser: GoogleUser = await authClient.getUser(await authClient.getAccessToken());

    const jwtSecret: string = process.env.JWT_SECRET;

    if (driveId) {
      const drive = await googleDriveService.getDrive(await authClient.getAccessToken(), driveId);
      if (drive.id) {
        const accessToken = await signToken({
          ...googleUser,
          ...await authClient.getAuthData(),
          driveId: driveId
        }, jwtSecret);
        setAccessCookie(res, accessToken);
        res.redirect(redirectTo || '/');
        return;
      }
    } else {
      const accessToken = await signToken({
        ...googleUser,
        ...await authClient.getAuthData(),
        driveId: driveId
      }, jwtSecret);
      setAccessCookie(res, accessToken);
      res.redirect(redirectTo || '/drive');
      return;
    }

    res.json({});
  } catch (err) {
    if (err.message.indexOf('invalid_grant') > -1) {
      if (req.query.state) {
        const state = new URLSearchParams(req.query.state.toString());
        const redirectTo = state.get('redirectTo');
        res.redirect(redirectTo || '/');
      } else {
        res.redirect('/');
      }
      return;
    }
    next(err);
  }
}

async function decodeAuthenticateInfo(req: Request, res: Response, next: NextFunction, logger: Logger) {
  const driveId = req['driveId'];

  if (!req.cookies.accessToken) {
    req.user = null;
    next();
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;

  try {
    const decoded = await verifyToken(req.cookies.accessToken, jwtSecret);
    if (!decoded.id) {
      return next(redirError(req, 'No jwt.sub'));
    }
    if (!decoded.google_access_token) {
      return next(redirError(req, 'No jwt.gat'));
    }

    const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
    await authClient.authorizeCookieData(decoded.google_access_token, decoded.google_refresh_token, decoded.google_expiry_date);

    req.user = {
      name: decoded.name,
      email: decoded.email,
      id: decoded.id,
      google_access_token: await authClient.getAccessToken()
    };

    if (driveId && decoded.driveId !== driveId) {
      const googleDriveService = new GoogleDriveService(logger, null);
      const drive = await googleDriveService.getDrive(await authClient.getAccessToken(), driveId);
      if (!drive) {
        return next(redirError(req, 'Unauthorized to read drive: ' + driveId));
      }

      const accessToken: string = await signToken({
        ...decoded,
        ...await authClient.getAuthData(),
        driveId: driveId
      }, jwtSecret);
      setAccessCookie(res, accessToken);
    }

    next();
  } catch (err) {
    if (err.status === 404 && req.user?.email) {
      err.message = err.message + `, user: ${req.user.email}`;
    }

    if (err.expiredAt) { // jsonwebtoken.TokenExpiredError
      res.clearCookie('accessToken');
      return next(redirError(req, 'JWT expired'));
    }
    if (err.message === 'invalid signature') {
      res.clearCookie('accessToken');
      return next(redirError(req, 'JWT invalid signature'));
    }
    if (err.message === 'Decryption failed') {
      res.clearCookie('accessToken');
      return next(redirError(req, 'Decryption failed'));
    }
    next(err);
  }
}

export function authenticateOptionally(logger: Logger) {
  return async (req, res, next) => {
    req['logger'] = logger;
    const parts = req.path.split('/');

    if (parts[0].length === 0) {
      parts.shift();
    }

    await decodeAuthenticateInfo(req, res, next, logger);
  };
}

function isLocal(req: Request) {
  const ip = req.socket.remoteAddress;
  const host = req.get('host');
  return ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === '::1' || host.indexOf('localhost') !== -1;
}

export function authenticate(logger: Logger, idx = 0) {
  return async (req: Request, res: Response, next: NextFunction) => {

    req['driveId'] = '';
    req['logger'] = logger;
    const parts = req.path.split('/');

    if (parts[0].length === 0) {
      parts.shift();
    }
    const driveId = (parts[idx] || '').replace('undefined', '');
    req['driveId'] = driveId || '';
    req['logger'] = req['driveId'] ? logger.child({driveId: req['driveId']}) : logger;

    if (!req.cookies.accessToken) {
      if (isLocal(req)) {
        next();
        return ;
      }
      return next(redirError(req, 'No accessToken cookie'));
    }

    await decodeAuthenticateInfo(req, res, next, logger);
  };
}

export function setAccessCookie(res: Response, accessToken: string) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
}
