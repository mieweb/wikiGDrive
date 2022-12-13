import jsonwebtoken from 'jsonwebtoken';
import {decrypt, encrypt, GoogleAuthService} from '../../google/GoogleAuthService';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {Logger} from 'winston';
import {Request} from 'express';

export function signToken(user: {id: string, name: string, email: string, google_access_token: string, google_refresh_token: string, google_expiry_date: number}, driveId: string, tokenType = 'ACCESS_TOKEN') {
  const expiresIn =
    tokenType === 'ACCESS_TOKEN'
      ? (process.env.JWT_ACCESS_TOKEN_EXPIRATION_TIME || 24*3600)
      : (process.env.JWT_REFRESH_TOKEN_EXPIRATION_TIME || 24*3600);
  return jsonwebtoken.sign({
    name: user.name,
    email: user.email,
    sub: user.id,
    driveId: driveId,
    tokenType,
    gat: encrypt(user.google_access_token, process.env.JWT_SECRET),
    grt: encrypt(user.google_refresh_token, process.env.JWT_SECRET),
    ged: user.google_expiry_date,
  }, process.env.JWT_SECRET, { expiresIn });
}

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
  const err = new AuthError(msg, 401);
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

export function authenticate(logger: Logger, idx = 0) {
  return async (req, res, next) => {
    req['driveId'] = '';
    req['logger'] = logger;
    const parts = req.path.split('/');

    if (parts[0].length === 0) {
      parts.shift();
    }
    const driveId = (parts[idx] || '').replace('undefined', '');

    if (!req.cookies.accessToken) {
      return next(redirError(req, 'No accessToken cookie'));
    }

    try {
      const decoded = jsonwebtoken.verify(req.cookies.accessToken, process.env.JWT_SECRET);
      if (!decoded.sub) {
        return next(redirError(req, 'No jwt.sub'));
      }
      if (!decoded['gat']) {
        return next(redirError(req, 'No jwt.gat'));
      }

      const google_access_token = decrypt(decoded['gat'], process.env.JWT_SECRET);
      const google_refresh_token = decrypt(decoded['grt'], process.env.JWT_SECRET);
      const google_expiry_date = decoded['ged'];

      if (process.env.VERSION === 'dev') {
        console.debug('google_access_token', google_access_token);
        console.debug('google_refresh_token', google_refresh_token);
        console.debug('google_expiry_date', google_expiry_date);
      }

      const googleDriveService = new GoogleDriveService(logger, null);

      req['driveId'] = driveId || '';
      req['logger'] = req['driveId'] ? logger.child({ driveId: req['driveId'] }) : logger;

      req.user = {
        name: decoded['name'],
        email: decoded['email'],
        id: decoded.sub,
        google_access_token,
        google_refresh_token,
        google_expiry_date
        // driveId: decoded.driveId
      };

      if (driveId && decoded['driveId'] !== driveId) {
        const drive = await googleDriveService.getDrive(google_access_token, driveId);
        if (!drive) {
          return next(redirError(req, 'Unauthorized to read drive: ' + driveId));
        }

        const accessToken = signToken(req.user, driveId);
        setAccessCookie(res, accessToken);
      }

      next();
    } catch (err) {
      if (err.status === 404 && req.user?.email) {
        err.message = err.message + `, user: ${req.user.email}`;
      }

      if (err.expiredAt) {
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
