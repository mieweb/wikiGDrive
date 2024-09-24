import type * as express from 'express';
import winston from 'winston';
import SwaggerDocService from './SwaggerDocService.ts';
import {instrumentAndWrap} from '../../../telemetry.ts';
// import SwaggerDocService from '../api-docs.api/SwaggerDocService';

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

export interface ControllerRouteParamUser {
  type: 'user';
  parameterIndex: number;
  docs?: RouteDoc;
}

export interface ControllerRouteParamBody {
  type: 'body';
  parameterIndex: number;
  docs?: RouteDoc;
}

export interface ControllerRouteParamHeaders {
  type: 'headers';
  parameterIndex: number;
  docs?: RouteDoc;
}

export interface ControllerRouteParamStream {
  type: 'stream';
  parameterIndex: number;
  docs?: RouteDoc;
}

export interface ControllerRouteParamGetAll {
  type: 'getAll';
  parameterIndex: number;
  queryFields: string[]
  docs?: RouteDoc;
}

export interface ControllerRouteParamRelated {
  type: 'related';
  parameterIndex: number;
  docs?: RouteDoc;
}

export interface ControllerRouteParamQuery {
  type: 'query';
  parameterIndex: number;
  name: string;
  docs?: RouteDoc;
}

export interface ControllerRouteParamMethod {
  type: 'method';
  parameterIndex: number;
  docs?: RouteDoc;
}

export interface ControllerRouteParamPath {
  type: 'path';
  parameterIndex: number;
  name: string;
  docs?: RouteDoc;
}

type ControllerRouteParam = ControllerRouteParamGetAll | ControllerRouteParamQuery
  | ControllerRouteParamBody | ControllerRouteParamHeaders | ControllerRouteParamPath | ControllerRouteParamStream
  | ControllerRouteParamRelated | ControllerRouteParamUser | ControllerRouteParamMethod;

export interface RouteDoc {
  description?: string;
  summary?: string;
  example?: string;
}

export class RouteFilter<K> implements ControllerCallContext {
  public readonly req: express.Request;
  public readonly res: express.Response;
  public readonly subPath: string;
  public readonly logger: winston.Logger;

  async filter(data: K): Promise<K> {
    return data;
  }
}

export class ErrorHandler implements ControllerCallContext {
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
  inputFilters: RouteFilter<unknown>[];
  outputFilters: RouteFilter<unknown>[];
  roles: string[];
  method?: string;
  routePath?: string;
  methodFunc: string;
  responseObjectType: string;
  responseContentType: string;
  responseStatus: number;
  params: ControllerRouteParam[];
  hidden: boolean;

  routeDocs?: RouteDoc;
  responseDocs?: RouteDoc;
}

export interface ControllerCallContext {
  subPath: string;
  req: express.Request;
  res: express.Response;
  logger: winston.Logger;
}

function addSwaggerRoute(mainPath: string, route: ControllerRoute) {
  SwaggerDocService.addRoute(mainPath, route);
}

export class Controller implements ControllerCallContext {
  private static routes: {[methodFunc: string]: ControllerRoute} = {};

  public readonly req: express.Request;
  public readonly res: express.Response;
  public readonly logger: winston.Logger;

  private static counter = 1;

  constructor(public readonly subPath: string) {
  }

  getRoute(classType, methodFunc: string) {
    if (!classType.controllerId) {
      classType.controllerId = 'controller_' + Controller.counter;
      Controller.counter++;
    }

    const key = classType.controllerId + '.' + methodFunc;

    if (!Controller.routes[key]) {
      Controller.routes[key] = {
        hidden: false,
        roles: [],
        params: [],
        inputFilters: [],
        outputFilters: [],
        errorHandlers: [],
        methodFunc,
        responseObjectType: 'object',
        responseStatus: HttpStatus.OK,
        responseContentType: 'application/json; charset=utf-8'
      };
    }
    return Controller.routes[key];
  }

  async getRouter() {
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
            this.logger.error(
              'User does not have any of those roles: ' +
              JSON.stringify(route.roles) +
              ', only: ' +
              req.user.global_role
            );
            // throw Boom.forbidden(req.t('auth.youNeedToBeAuthorized'));
          }
        });
      }

      // const data = await inputEntitiesFilter.getItemFilter().clearApiData(body, this.user);
      // const filteredData = await outputEntitiesFilter.clearApiData(created, this.user);

      handlers.push(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        try {
          const methods = getMethods(this.constructor.prototype);
          const bound = this[route.methodFunc].bind({
            ...methods,
            ...this,
            subPath: this.subPath,
            req,
            res,
            logger: req['logger']
          });

          res.header('Content-type', route.responseContentType);

          const args = [];
          for (const param of route.params) {
            for (let idx = args.length; args.length <= param.parameterIndex; idx++) {
              args.push(undefined);
            }

            switch (param.type) {
              case 'user':
                {
                  args[param.parameterIndex] = req.user;
                }
                break;
              case 'body':
                {
                  let body = req.body;
                  for (const inputFilter of route.inputFilters) {
                    const boundFilter = inputFilter.filter.bind({
                      ...this,
                      ...inputFilter,
                      subPath: this.subPath,
                      req,
                      res
                    });
                    body = await boundFilter(body);
                  }
                  args[param.parameterIndex] = body;
                }
                break;
              case 'headers':
                {
                  const headers = req.headers;
                  args[param.parameterIndex] = headers;
                }
                break;
              case 'stream':
                args[param.parameterIndex] = req;
                break;
              case 'getAll':
                // args[param.parameterIndex] = ApiUtils.buildOptions(req, param.queryFields);
                break;
              case 'path':
                args[param.parameterIndex] = req.params[param.name];
                break;
              case 'query':
                args[param.parameterIndex] = req.query[param.name];
                break;
              case 'method':
                args[param.parameterIndex] = req.method.toLowerCase();
                break;
            }
          }

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
  return function (controller: Controller, methodFunc: string) {
    const route = controller.getRoute(controller, methodFunc);
    route.routePath = routePath;
    route.method = 'USE';
    route.routeDocs = docs;
  };
}

export function RouteGet(routePath: string, docs: RouteDoc = {}) {
  return function (controller: Controller, methodFunc: string) {
    const route = controller.getRoute(controller, methodFunc);
    route.routePath = routePath;
    route.method = 'GET';
    route.routeDocs = docs;
  };
}

export function RoutePut(routePath: string, docs: RouteDoc = {}) {
  return function (controller: Controller, methodFunc: string) {
    const route = controller.getRoute(controller, methodFunc);
    route.routePath = routePath;
    route.method = 'PUT';
    route.routeDocs = docs;
  };
}

export function RoutePost(routePath: string, docs: RouteDoc = {}) {
  return function (controller: Controller, methodFunc: string) {
    const route = controller.getRoute(controller, methodFunc);
    route.routePath = routePath;
    route.method = 'POST';
    route.routeDocs = docs;
  };
}

export function RouteDelete(routePath: string, docs: RouteDoc = {}) {
  return function (controller: Controller, methodFunc: string) {
    const route = controller.getRoute(controller, methodFunc);
    route.routePath = routePath;
    route.method = 'DELETE';
    route.routeDocs = docs;
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
  return function (controller: Controller, methodProp: string) {
    const route = controller.getRoute(controller, methodProp);
    route.responseObjectType = objType;
    route.responseContentType = contentType;
    route.responseDocs = docs;
  };
}

export function RouteInputFilter<K>(filter: RouteFilter<K>) {
  return function (controller: Controller, methodProp: string) {
    const route = controller.getRoute(controller, methodProp);
    route.inputFilters.push(filter);
  };
}

export function RouteOutputFilter<K>(filter: RouteFilter<K>) {
  return function (controller: Controller, methodProp: string) {
    const route = controller.getRoute(controller, methodProp);
    route.outputFilters.push(filter);
  };
}

export function RouteErrorHandler(errorHandler: ErrorHandler) {
  return function (controller: Controller, methodProp: string) {
    const route = controller.getRoute(controller, methodProp);
    route.errorHandlers.push(errorHandler);
  };
}

export function RouteResponseStatus(status: number = HttpStatus.OK) {
  return function (controller: Controller, methodProp: string) {
    const route = controller.getRoute(controller, methodProp);
    route.responseStatus = status;
  };
}

export function RouteParamUser(docs: RouteDoc = {}) {
  return function (targetClass: Controller, methodProp: string, parameterIndex: number) {
    const route = targetClass.getRoute(targetClass, methodProp);
    const param: ControllerRouteParamUser = {
      type: 'user',
      parameterIndex,
      docs
    };
    route.params.push(param);
  };
}

export function RouteParamBody(docs: RouteDoc = {}) {
  return function (targetClass: Controller, methodProp: string, parameterIndex: number) {
    const route = targetClass.getRoute(targetClass, methodProp);
    const param: ControllerRouteParamBody = {
      type: 'body',
      parameterIndex,
      docs
    };
    route.params.push(param);
  };
}

export function RouteParamHeaders(docs: RouteDoc = {}) {
  return function (targetClass: Controller, methodProp: string, parameterIndex: number) {
    const route = targetClass.getRoute(targetClass, methodProp);
    const param: ControllerRouteParamHeaders = {
      type: 'headers',
      parameterIndex,
      docs
    };
    route.params.push(param);
  };
}

export function RouteParamStream(docs: RouteDoc = {}) {
  return function (targetClass: Controller, methodProp: string, parameterIndex: number) {
    const route = targetClass.getRoute(targetClass, methodProp);
    const param: ControllerRouteParamStream = {
      type: 'stream',
      parameterIndex,
      docs
    };
    route.params.push(param);
  };
}

export function RouteParamGetAll(queryFields = []) {
  return function (targetClass: Controller, methodProp: string, parameterIndex: number) {
    const route = targetClass.getRoute(targetClass, methodProp);
    const param: ControllerRouteParamGetAll = {
      type: 'getAll',
      parameterIndex,
      queryFields,
      docs: {
        summary: 'Sort and pagination'
      }
    };
    route.params.push(param);
  };
}

export function RouteParamRelated() {
  return function (targetClass: Controller, methodProp: string, parameterIndex: number) {
    const route = targetClass.getRoute(targetClass, methodProp);
    const param: ControllerRouteParamRelated = {
      type: 'related',
      parameterIndex,
      docs: {
        summary: 'Related fields'
      }
    };
    route.params.push(param);
  };
}

export function RouteParamPath(name: string, docs: RouteDoc = {}) {
  return function (targetClass: Controller, methodProp: string, parameterIndex: number) {
    const route = targetClass.getRoute(targetClass, methodProp);
    const param: ControllerRouteParamPath = {
      type: 'path',
      parameterIndex,
      name,
      docs
    };
    route.params.push(param);
  };
}

export function RouteParamQuery(name: string, docs: RouteDoc = {}) {
  return function (targetClass: Controller, methodProp: string, parameterIndex: number) {
    const route = targetClass.getRoute(targetClass, methodProp);
    const param: ControllerRouteParamQuery = {
      type: 'query',
      parameterIndex,
      name,
      docs
    };
    route.params.push(param);
  };
}

export function RouteParamMethod(docs: RouteDoc = {}) {
  return function (targetClass: Controller, methodProp: string, parameterIndex: number) {
    const route = targetClass.getRoute(targetClass, methodProp);
    const param: ControllerRouteParamMethod = {
      type: 'method',
      parameterIndex,
      docs
    };
    route.params.push(param);
  };
}
