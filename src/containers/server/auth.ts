import jsonwebtoken from 'jsonwebtoken';
import {decrypt, encrypt} from '../../google/GoogleAuthService';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {Logger} from 'winston';
import {Request, Response} from 'express';
import {UserAuthClient} from '../../google/AuthClient';
import {FolderRegistryContainer} from '../folder_registry/FolderRegistryContainer';
import {urlToFolderId} from '../../utils/idParsers';
import {JobManagerContainer} from '../job/JobManagerContainer';

export class AuthError extends Error {
  public status: number;
  public authPath: string;
  public redirectTo: string;
  public showHtml = false;
  constructor(msg, status) {
    super(msg);
    this.status = status;
  }
}

export function redirError(req: Request, msg: string) {
  const err = new AuthError(msg + ' for: ' + req.originalUrl, 401);
  const [empty, driveId] = req.path.split('/');

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

export function signToken(payload: JwtDecryptedPayload): string {
  const expiresIn = 365 * 24 * 3600; // process.env.JWT_ACCESS_TOKEN_EXPIRATION_TIME ||

  const encrypted: JwtEncryptedPayload = {
    sub: payload.id,
    name: payload.name,
    email: payload.email,
    gat: encrypt(payload.google_access_token, process.env.JWT_SECRET),
    grt: payload.google_refresh_token ? encrypt(payload.google_refresh_token, process.env.JWT_SECRET) : undefined,
    ged: payload.google_expiry_date,
    driveId: payload.driveId
  };

  return jsonwebtoken.sign(encrypted, process.env.JWT_SECRET, { expiresIn });
}

export function verifyToken(accessCookie: string): JwtDecryptedPayload {
  const encrypted: JwtEncryptedPayload = <JwtEncryptedPayload>jsonwebtoken.verify(accessCookie, process.env.JWT_SECRET);

  return {
    id: encrypted.sub,
    name: encrypted.name,
    email: encrypted.email,
    google_access_token: decrypt(encrypted.gat, process.env.JWT_SECRET),
    google_refresh_token: encrypted.grt ? decrypt(encrypted.grt, process.env.JWT_SECRET) : undefined,
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
    const hostname = req.header('host');
    const protocol = hostname.indexOf('localhost') > -1 ? 'http://' : 'https://';
    const serverUrl = protocol + hostname;

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

export async function handleShare(req: Request, res: Response, next) {
  try {
    const hostname = req.header('host');
    const protocol = hostname.indexOf('localhost') > -1 ? 'http://' : 'https://';
    const serverUrl = protocol + hostname;

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

export async function handlePopupClose(req: Request, res: Response, next) {
  try {
    const state = new URLSearchParams(req.query.state.toString());
    if (state.get('popupWindow') === 'true') {
      openerRedirect(res, req.url.replace('popupWindow', ''));
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export async function getAuth(req, res: Response, next) {
  try {
    const hostname = req.header('host');
    const protocol = hostname.indexOf('localhost') > -1 ? 'http://' : 'https://';
    const serverUrl = protocol + hostname;

    const state = new URLSearchParams(req.query.state.toString());

    const driveId = urlToFolderId(state.get('driveId'));
    const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');

    const shareDrive = !!state.get('shareDrive');
    if (driveId && shareDrive) {
      const googleDriveService = new GoogleDriveService(this.logger, null);
      const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
      await authClient.authorizeResponseCode(req.query.code, `${serverUrl}/auth`);

      await googleDriveService.shareDrive(await authClient.getAccessToken(), driveId, this.params.share_email);

      await folderRegistryContainer.registerFolder(driveId);
      res.redirect('/drive/' + driveId);
      return;
    }

    const uploadDrive = !!state.get('uploadDrive');
    if (driveId && uploadDrive) {
      const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
      await authClient.authorizeResponseCode(req.query.code, `${serverUrl}/auth`);

      const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');
      await jobManagerContainer.schedule(driveId, {
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
    const redirectTo = urlToFolderId(state.get('redirectTo'));

    const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
    await authClient.authorizeResponseCode(req.query.code, `${serverUrl}/auth`);
    const googleDriveService = new GoogleDriveService(this.logger, null);
    const googleUser: GoogleUser = await authClient.getUser(await authClient.getAccessToken());

    if (driveId) {
      const drive = await googleDriveService.getDrive(await authClient.getAccessToken(), driveId);
      if (drive.id) {
        const accessToken = signToken({
          ...googleUser,
          ...await authClient.getAuthData(),
          driveId: driveId
        });
        setAccessCookie(res, accessToken);
        res.redirect(redirectTo || '/');
        return;
      }
    } else {
      const accessToken = signToken({
        ...googleUser,
        ...await authClient.getAuthData(),
        driveId: driveId
      });
      setAccessCookie(res, accessToken);
      res.redirect(redirectTo || '/');
      return;
    }

    res.json({});
  } catch (err) {
    if (err.message.indexOf('invalid_grant') > -1) {
      if (req.query.state) {
        const state = new URLSearchParams(req.query.state);
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

async function decodeAuthenticateInfo(req, res, next) {
  const driveId = req['driveId'];
  const logger = req['logger'];

  if (!req.cookies.accessToken) {
    req.user = null;
    next();
    return;
  }

  try {
    const decoded = verifyToken(req.cookies.accessToken);
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

      const accessToken: string = signToken({
        ...decoded,
        ...await authClient.getAuthData(),
        driveId: driveId
      });
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
    next(err);
  }
}

export function authenticateOptionally(logger: Logger, idx = 0) {
  return async (req, res, next) => {
    req['driveId'] = '';
    req['logger'] = logger;
    const parts = req.path.split('/');

    if (parts[0].length === 0) {
      parts.shift();
    }
    const driveId = (parts[idx] || '').replace('undefined', '');
    req['driveId'] = driveId || '';
    req['logger'] = req['driveId'] ? logger.child({driveId: req['driveId']}) : logger;

    await decodeAuthenticateInfo(req, res, next);
  };
}

export function authenticate(logger: Logger, idx = 0) {
  return async (req, res, next) => {
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
      return next(redirError(req, 'No accessToken cookie'));
    }

    await decodeAuthenticateInfo(req, res, next);
  };
}

export function setAccessCookie(res, accessToken) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
}
