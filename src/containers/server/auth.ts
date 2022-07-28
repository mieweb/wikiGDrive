import jsonwebtoken from 'jsonwebtoken';

export function signToken(user: {id: string, name: string, email: string}, driveId: string, tokenType = 'ACCESS_TOKEN') {
  const expiresIn =
    tokenType === 'ACCESS_TOKEN'
      ? process.env.JWT_ACCESS_TOKEN_EXPIRATION_TIME
      : process.env.JWT_REFRESH_TOKEN_EXPIRATION_TIME;
  return jsonwebtoken.sign({ name: user.name, email: user.email, sub: user.id, driveId: driveId, tokenType }, process.env.JWT_SECRET, { expiresIn });
}

class AuthError extends Error {
  private status: number;
  public authPath: string;
  public redirectTo: string;
  constructor(msg, status) {
    super(msg);
    this.status = status;
  }
}

function redirError(req, msg) {
  const err = new AuthError(msg, 401);
  const [empty, driveId] = req.path.split('/');

  if (req.headers['redirect-to']) {
    err.redirectTo = req.headers['redirect-to'];
  } else {
    err.redirectTo = '/drive/' + driveId;
  }
  if (driveId) {
    err.authPath = '/auth/' + driveId + '?redirectTo=' + err.redirectTo;
  }

  return err;
}

export function authenticate(idx = 0) {
  return (req, res, next) => {

    next();
    return;

    const parts = req.path.split('/');

    if (parts[0].length === 0) {
      parts.shift();
    }
    const driveId = parts[idx] || '';

    if (!req.cookies.accessToken) {
      return next(redirError(req, 'No accessToken cookie'));
    }

    const decoded = jsonwebtoken.verify(req.cookies.accessToken, process.env.JWT_SECRET);

    if (!decoded.sub) {
      return next(redirError(req, 'No jwt.sub'));
    }

    if (driveId && decoded['driveId'] !== driveId) {
      res.cookie('accessToken', '', {
        httpOnly: true,
        secure: true
      });
      return next(redirError(req, 'Authenticated for different drive'));
    }

    req.user = {
      name: decoded['name'],
      email: decoded['email'],
      userId: decoded.sub
      // driveId: decoded.driveId
    };
    next();
  };
}
