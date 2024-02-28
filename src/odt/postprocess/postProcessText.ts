import {} from '../StateMachine.ts';
import {isBeginMacro, isEndMacro} from './mergeParagraphs.ts';

export function emptyString(str: string) {
  return str.trim().length === 0;
}

export function postProcessText(markdown: string): string {
  const lines = markdown.split('\n');

  function addEmptyLineBefore(lineNo: number) {
    lines.splice(lineNo, 0, '');
    if (lineNo > 0 && lines[lineNo - 1].endsWith('  ')) {
      lines[lineNo - 1] = lines[lineNo - 1].replace(/ +$/, '');
    }
  }

  function hasClosingMacroAfter(lineNo: number, currentLine: string) {
    const closingText = currentLine.replace('{{% ', '{{% /');
    for (let idx = lineNo + 1; idx < lines.length; idx++) {
      if (lines[idx] === closingText) {
        return true;
      }
    }
    return false;
  }

  for (let lineNo = 1; lineNo < lines.length; lineNo++) {
    const prevLine = lines[lineNo - 1];
    const currentLine = lines[lineNo];
    if (isBeginMacro(currentLine) && !emptyString(prevLine) && hasClosingMacroAfter(lineNo, currentLine)) {
      addEmptyLineBefore(lineNo);
      lineNo--;
      continue;
    }
  }

  for (let lineNo = 0; lineNo < lines.length - 1; lineNo++) {
    const currentLine = lines[lineNo];
    const nextLine = lines[lineNo + 1];
    if (isBeginMacro(currentLine) && emptyString(nextLine) && hasClosingMacroAfter(lineNo, currentLine)) {
      lines.splice(lineNo + 1, 1);
      lineNo--;
      continue;
    }
  }

  for (let lineNo = 0; lineNo < lines.length - 1; lineNo++) {
    const currentLine = lines[lineNo];
    const nextLine = lines[lineNo + 1];
    if (isEndMacro(currentLine) && !emptyString(nextLine)) {
      addEmptyLineBefore(lineNo + 1);
      lineNo--;
      continue;
    }
  }

  for (let lineNo = 1; lineNo < lines.length; lineNo++) {
    const prevLine = lines[lineNo - 1];
    const currentLine = lines[lineNo];
    if (isEndMacro(currentLine) && emptyString(prevLine)) {
      lines.splice(lineNo - 1, 1);
      lineNo--;
      continue;
    }
  }


  return lines.join('\n');
}
