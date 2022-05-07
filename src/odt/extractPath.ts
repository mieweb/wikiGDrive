import {DrawEquation} from './LibreOffice';
import {create, all} from 'mathjs';

const math = create(all);
math.import({
  if: (a,b,c) => a ? b : c
}, {});

function cleanUpFormula(formula: string) {
  return formula
    .replace(/\?f/g, 'f')
    .replace(/\$[\d]+/g, '0');
}

export function extractPath(pathSource: string, equations: DrawEquation[]): string {
  const variables = {};
  for (const equation of equations) {
    variables[equation.name] = cleanUpFormula(equation.formula);
  }

  variables['logwidth'] = 100;
  variables['logheight'] = 100;

  let change = true;
  while (change) {
    change = false;
    for (const k in variables) {
      try {
        const nevValue = math.evaluate(variables[k], variables);
        if (nevValue !== variables[k]) {
          variables[k] = nevValue;
          change = true;
          continue;
        }
        // eslint-disable-next-line no-empty
      } catch (ignore) {}
    }
  }

  const evaluateVariable = (name) => {
    const scope = Object.assign({}, variables, {});

    let value = name;
    let retry = 1;
    while (retry > 0) {
      if (typeof value === 'number') {
        break;
      }
      retry--;
      value = value.replace(/\?f/g, 'f');

      const newValue = math.evaluate(scope[value] ? scope[value] : value, scope);
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
  return path;
}
