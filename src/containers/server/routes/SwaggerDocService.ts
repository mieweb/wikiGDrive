import json from './swagger.json';
import { ControllerRoute } from './Controller';

class SwaggerDoc {

  json = json;

  constructor() {
    json.info.title = process.env.APP_NAME;
    json.info.description = process.env.APP_NAME;
    json.info.version = process.env.APP_VERSION;
  }

  toJSON() {
    return json;
  }

  addRoute(mainPath: string, route: ControllerRoute) {
    const routePath = mainPath + route.routePath
      .split('/')
      .map(p => p.startsWith(':') ? '{' + p.substring(1) + '}' : p)
      .join('/');
    if (!json.paths[routePath]) {
      json.paths[routePath] = {};
    }

    const methodDesc = json.paths[routePath][route.method.toLowerCase()] = {};
    methodDesc['tags'] = [mainPath];
    methodDesc['summary'] = route.routeDocs?.summary;
    methodDesc['description'] = route.routeDocs?.description;
    // methodDesc['requestBody'] = '';

    methodDesc['parameters'] = [];
    for (const param of route.params) {
      switch (param.type) {
        case 'path':
          methodDesc['parameters'].push({
            'name': param.name,
            'in': 'path',
            'summary': param.docs?.description,
            'description': param.docs?.description,
            'example': param.docs?.example,
            'required': true,
            'schema': {
              'type': 'string'
            }
          });
          break;
        case 'query':
          methodDesc['parameters'].push({
            'name': param.name,
            'in': 'query',
            'summary': param.docs?.summary,
            'description': param.docs?.description,
            'example': param.docs?.example,
            // "required": true,
            'schema': {
              'type': 'string'
            }
          });
          break;
      }
    }

    methodDesc['responses'] = {};

    methodDesc['responses'][route.responseStatus] = {
      'description': route.responseDocs?.description,
      'summary': route.responseDocs?.summary
    };

    if (route.responseObjectType.startsWith('PaginatedData:')) {
      const objName = route.responseObjectType.substring('PaginatedData:'.length);
      methodDesc['responses'][route.responseStatus]['content'] = {
        'application/json': {
          'schema': {
            'allOf': [

              {
                '$ref': '#/components/schemas/PaginatedData'
              },

              /*              {
                              "type": "object",
                              "properties": {
                                "data": {
                                  "type": "array",
                                  "items": {
                                    "$ref": "#/components/schemas/" + objName
                                  }
                                }
                              }
                            }*/
            ]
          }
        }
      };
    } else {
      switch (route.responseObjectType) {
        case '':
      }
      methodDesc['responses'][route.responseStatus]['content'] = {
        'application/json': {
          'schema': {
            '$ref': '#/components/schemas/User'
          }
        }
      };
    }

  }
}

export default new SwaggerDoc();
