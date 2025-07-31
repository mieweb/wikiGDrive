import process from 'node:process';

import type * as express from 'express';
import winston from 'winston';
import {instrumentAndWrap} from '../../../telemetry.ts';

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204
};

function getMethods(obj) {
  const res = {};
  for(const m of Object.getOwnPropertyNames(obj.constructor.prototype)) {
    res[m] = obj[m];
  }
  return res;
}

export interface RouteDoc {
  description?: string;
  summary?: string;
  example?: string;
}

export class ErrorHandler {
  public readonly req: express.Request;
  public readonly res: express.Response;
  public readonly subPath: string;
  public readonly logger: winston.Logger;

  async catch(err) {
    throw err;
  }
}

export interface ControllerRoute {
  errorHandlers: ErrorHandler[];
  roles: string[];
  method?: string;
  routePath?: string;
  methodFunc: string;
  responseObjectType: string;
  responseContentType: string;
  responseStatus: number;
  hidden: boolean;

  routeDocs?: RouteDoc;
  responseDocs?: RouteDoc;
}

export class ControllerCallContext {

  constructor(
    public readonly route: ControllerRoute,
    public readonly subPath: string,
    public readonly req: express.Request,
    public readonly res: express.Response,
    public readonly logger: winston.Logger
  ) {
  }

  async routeParamMethod(): Promise<string> {
    return this.req.method.toLowerCase();
  }

  async routeParamPath(name: string): Promise<string> {
    return this.req.params[name];
  }

  async routeParamBody<K>(): Promise<K> {
    return this.req.body;
  }

  async routeParamQuery<K>(name: string): Promise<K> {
    return this.req.query[name];
  }

  async routeParamUser(): Promise<any> {
    return this.req.user;
  }
}

function addSwaggerRoute(mainPath: string, route: ControllerRoute) {
  // SwaggerDocService.addRoute(mainPath, route);
}

export class Controller {
  private static routes: {[methodFunc: string]: ControllerRoute} = {};
  private static counter = 1;

  constructor(public readonly subPath: string) {
  }

  getRoute(instance: Controller, methodFunc: string) {
    const classType = instance.constructor.prototype;
    if (!classType.controllerId) {
      classType.controllerId = 'controller_' + Controller.counter;
      Controller.counter++;
    }

    const key = classType.controllerId + '.' + methodFunc;

    if (!Controller.routes[key]) {
      Controller.routes[key] = {
        hidden: false,
        roles: [],
        errorHandlers: [],
        methodFunc,
        responseObjectType: 'object',
        responseStatus: HttpStatus.OK,
        responseContentType: 'application/json; charset=utf-8'
      };
    }
    return Controller.routes[key];
  }

  async getRouter(): Promise<express.Router> {
    const controllerId = this.constructor.prototype.controllerId;
    const { Router} = await import('express');
    const router = Router();

    for (const key in Controller.routes) {
      if (!key.startsWith(controllerId + '.')) {
        continue;
      }

      const route = Controller.routes[key];
      if (!route.hidden) {
        addSwaggerRoute(this.subPath, route);
      }

      const handlers = [];
      if (route.roles.length > 0) {
        handlers.push((req, res, next) => {
          if (req.user && route.roles.indexOf(req.user.global_role) > -1) {
            next();
          } else {
            const logger = req['logger'];
            logger.error(
              'User does not have any of those roles: ' +
              JSON.stringify(route.roles) +
              ', only: ' +
              req.user.global_role
            );
            // throw Boom.forbidden(req.t('auth.youNeedToBeAuthorized'));
          }
        });
      }

      handlers.push(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        try {
          const methods = getMethods(this.constructor.prototype);
          const bound = this[route.methodFunc].bind({
            ...methods,
            ...this,
          });

          res.header('Content-type', route.responseContentType);

          const args = [];

          const logger = req['logger'];
          const ctx = new ControllerCallContext(route, this.subPath, req, res, logger);
          args.push(ctx);

          let retVal;

          if (process.env.ZIPKIN_URL) {
            const spanName = req.originalUrl + '.' + route.methodFunc;
            await instrumentAndWrap(spanName, req, res, async () => {
              retVal = await bound(...args);
            });
          } else {
            retVal = await bound(...args);
          }

          if ('stream' === route.responseObjectType) {
            return;
          }
          if ('void' === route.responseObjectType) {
            res.status(HttpStatus.NO_CONTENT).send();
            return;
          }
          if ('html' === route.responseObjectType) {
            res.status(route.responseStatus).send(retVal);
            return;
          }

          res.status(route.responseStatus).json(retVal);
        } catch (err) {
          let err1 = err;
          for (const inputFilter of route.errorHandlers) {
            try {
              const boundErrorHandler = inputFilter.catch.bind({
                ...this,
                ...inputFilter,
                subPath: this.subPath,
                req,
                res
              });
              await boundErrorHandler(err);
            } catch (subErr) {
              err1 = subErr;
            }
          }
          next(err1);
        }
      });

      switch (route.method) {
        case 'GET':
          router.get(route.routePath, ...handlers);
          break;
        case 'POST':
          router.post(route.routePath, ...handlers);
          break;
        case 'PUT':
          router.put(route.routePath, ...handlers);
          break;
        case 'DELETE':
          router.delete(route.routePath, ...handlers);
          break;
        case 'USE':
          router.use(route.routePath, ...handlers);
          break;
      }
    }

    return router;
  }
}

export function RouteUse(routePath: string, docs: RouteDoc = {}) {
  return function (_func: undefined, ctx: DecoratorContext) {
    ctx.addInitializer(function () {
      const route = this.getRoute(this, ctx.name);
      route.routePath = routePath;
      route.method = 'USE';
      route.routeDocs = docs;
    });
  };
}

export function RouteGet(routePath: string, docs: RouteDoc = {}) {
  return function (_func: undefined, ctx: DecoratorContext) {
    ctx.addInitializer(function () {
      const route = this.getRoute(this, ctx.name);
      route.routePath = routePath;
      route.method = 'GET';
      route.routeDocs = docs;
    });
  };
}

export function RoutePut(routePath: string, docs: RouteDoc = {}) {
  return function (_func: undefined, ctx: DecoratorContext) {
    ctx.addInitializer(function () {
      const route = this.getRoute(this, ctx.name);
      route.routePath = routePath;
      route.method = 'PUT';
      route.routeDocs = docs;
    });
  };
}

export function RoutePost(routePath: string, docs: RouteDoc = {}) {
  return function (_func: undefined, ctx: DecoratorContext) {
    ctx.addInitializer(function () {
      const route = this.getRoute(this, ctx.name);
      route.routePath = routePath;
      route.method = 'POST';
      route.routeDocs = docs;
    });
  };
}

export function RouteDelete(routePath: string, docs: RouteDoc = {}) {
  return function (_func: undefined, ctx: DecoratorContext) {
    ctx.addInitializer(function () {
      const route = this.getRoute(this, ctx.name);
      route.routePath = routePath;
      route.method = 'DELETE';
      route.routeDocs = docs;
    });
  };
}

export function RouteDocsHidden() {
  return function (controller, methodProp: string) {
    const route = controller.getRoute(controller, methodProp);
    route.hidden = true;
  };
}

export function RouteHasRole(roles: string[]) {
  return function (controller, methodProp: string) {
    const route = controller.getRoute(controller, methodProp);
    route.roles = roles;
  };
}

export function RouteResponse(objType = 'object', docs: RouteDoc = {}, contentType = 'application/json; charset=utf-8') {
  return function (_func: undefined, ctx: DecoratorContext) {
    ctx.addInitializer(function () {
      const route = this.getRoute(this, ctx.name);
      route.responseObjectType = objType;
      route.responseContentType = contentType;
      route.responseDocs = docs;
    });
  };
}

// TODO: remove
export function RouteErrorHandler(errorHandler: ErrorHandler) {
  return function (_func: undefined, ctx: DecoratorContext) {
    ctx.addInitializer(function () {
      const route = this.getRoute(this, ctx.name);
      route.errorHandlers.push(errorHandler);
    });
  };
}

export function RouteResponseStatus(status: number = HttpStatus.OK) {
  return function (_func: undefined, ctx: DecoratorContext) {
    ctx.addInitializer(function () {
      const route = this.getRoute(this, ctx.name);
      route.responseStatus = status;
    });
  };
}
