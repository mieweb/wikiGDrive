import jsonwebtoken from 'jsonwebtoken';
import {decrypt, encrypt} from '../../google/GoogleAuthService';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {Logger} from 'winston';
import {Request, Response} from 'express';
import {UserAuthClient} from '../../google/AuthClient';
import {FolderRegistryContainer} from '../folder_registry/FolderRegistryContainer';

export class AuthError extends Error {
  public status: number;
  public authPath: string;
  public redirectTo: string;
  constructor(msg, status) {
    super(msg);
    this.status = status;
  }
}

function redirError(req: Request, msg: string) {
  const err = new AuthError(msg + ' for: ' + req.originalUrl, 401);
  const [empty, driveId] = req.path.split('/');

  if (req.headers['redirect-to']) {
    err.redirectTo = req.headers['redirect-to'].toString();
  } else {
    err.redirectTo = '/drive/' + (driveId || '');
  }
  if (driveId) {
    err.authPath = '/auth/' + driveId + '?redirectTo=' + err.redirectTo;
  } else {
    err.authPath = '/auth/none?redirectTo=' + err.redirectTo;
  }

  if (process.env.VERSION === 'dev') {
    console.trace();
    console.debug('redirError');
    console.debug('  driveId', driveId);
    console.debug('  req.headers[\'redirect-to\']', req.headers['redirect-to']);
    console.debug('  err.redirectTo', err.redirectTo);
    console.debug('  err.authPath', err.authPath);
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
    grt: encrypt(payload.google_refresh_token, process.env.JWT_SECRET),
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
    google_refresh_token: decrypt(encrypted.grt, process.env.JWT_SECRET),
    google_expiry_date: encrypted.ged,
    driveId: encrypted.driveId
  };
}

function openerRedirect(res: Response, redirectTo: string) {
  res.send(`<script>window.opener.authenticated('${redirectTo}');window.close();</script>`);
}

export async function getAuth(req, res, next){
  try {
    const hostname = req.header('host');
    const protocol = hostname.indexOf('localhost') > -1 ? 'http://' : 'https://';
    const serverUrl = protocol + hostname;

    if (!req.query.state) {
      throw new Error('No state query parameter');
    }
    const state = new URLSearchParams(req.query.state);
    const driveui = state.get('driveui');
    if (driveui) {
      const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
      await authClient.authorizeResponseCode(req.query.code, `${serverUrl}/auth`);
      res.redirect('/driveui/installed');
      return;
    }

    const shareId = state.get('shareId');
    if (shareId) {
      const authClient = new UserAuthClient(process.env.GOOGLE_AUTH_CLIENT_ID, process.env.GOOGLE_AUTH_CLIENT_SECRET);
      await authClient.authorizeResponseCode( req.query.code, `${serverUrl}/auth`);
      return;
    }

    if (!req.query.not_popup) {
      openerRedirect(res, req.url + '&not_popup=1');
      return;
    }

    const driveId = state.get('driveId');
    const folderRegistryContainer = <FolderRegistryContainer>this.engine.getContainer('folder_registry');
    if (driveId && !folderRegistryContainer.hasFolder(driveId)) {
      throw new Error('Folder not registered');
    }
    const redirectTo = state.get('redirectTo');

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
    req['logger'] = req['driveId'] ? logger.child({ driveId: req['driveId'] }) : logger;

    if (!req.cookies.accessToken) {
      return next(redirError(req, 'No accessToken cookie'));
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
  };
}

export function setAccessCookie(res, accessToken) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
}
