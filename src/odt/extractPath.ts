import {DrawEnhancedGeometry, DrawEquation} from './LibreOffice.ts';
import {create, all} from 'mathjs';

const math = create(all);
math.import({
  if: (a: boolean, b: number, c: number) => a ? b : c
}, {});

function cleanUpFormula(formula: string) {
  return formula
    .replace(/\?f/g, 'f')
    .replace(/\$[\d]+/g, '0');
}

export function extractPath(drawEnhancedGeometry: DrawEnhancedGeometry, logwidth: number, logheight: number): string {
  // const pathSource: string = drawEnhancedGeometry.path2 || drawEnhancedGeometry.path;
  const pathSource: string = drawEnhancedGeometry.path;
  const equations: DrawEquation[] = drawEnhancedGeometry.equations;

  const variables = {};
  if (Array.isArray(equations)) {
    for (const equation of equations) {
      variables[equation.name] = cleanUpFormula(equation.formula);
    }
  }

  variables['logwidth'] = logwidth;
  variables['logheight'] = logheight;

  let change = true;
  while (change) {
    change = false;
    for (const k in variables) {
      try {
        const nevValue = math.evaluate(variables[k], variables);
        if (nevValue !== variables[k]) {
          variables[k] = nevValue;
          change = true;
        }
      } catch (ignore) { /* empty */ }
    }
  }

  const evaluateVariable = (name) => {
    const scope: Record<string, any> = Object.assign({}, variables, {});

    let value = name;
    let retry = 1;
    while (retry > 0) {
      if (typeof value === 'string' && value in scope) {
        value = scope[value];
      }
      if (typeof value === 'number') {
        break;
      }
      retry--;
      value = value.replace(/\?f/g, 'f');

      const newValue = math.evaluate(value, scope);
      if (newValue !== value) {
        retry++;
      }
      value = newValue;
    }
    return value;
  };

  let loopLimit = 1000; // to avoid infinite loop
  let path = pathSource;
  while (path.match('\\?f[\\d]+')) {
    const variable = path.match('\\?f[\\d]+')[0].slice(1);
    const calculatedValue = evaluateVariable(variable);
    path = path.replace('?' + variable, calculatedValue);
    if (loopLimit-- < 0) {
      console.error('loopLimit is out, looks like you have got an infinite loop here');
    }
  }
  return path.replace(/ N$/, '');
}
