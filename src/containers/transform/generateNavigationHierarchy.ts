'use strict';

import {urlToFolderId} from '../../utils/idParsers';
import {FileId} from '../../model/model';
import {DocumentContent, TextLink, TextList, TextParagraph, TextSpace, TextSpan, TextTab} from '../../odt/LibreOffice';

export interface NavigationHierarchyNode {
  name: string;
  weight: number;
  identifier: FileId;
  parent?: FileId;
  pageRef?: string;
}

export interface NavigationHierarchy {
  [k: string]: NavigationHierarchyNode;
}

interface Logger {
  warn(mxg: string): void;
}

interface NavigationProcessContext {
  headerCounter: number;
  lastContent: string;
  counter: number;
  levelParent: {[level: number]: string};
  logger: Logger;
  result: NavigationHierarchy;
}

function extractText(obj: string | TextLink | TextSpan | TextSpace | TextTab): string {
  let retVal = '';

  if (typeof obj === 'string') {
    retVal += obj;
  } else {
    if (obj.type === 'space') {
      retVal += '               '.substring(0, (<TextSpace>obj).chars);
    }
    if (obj.type === 'tab') {
      retVal += '\t';
    }
    if (obj.type === 'link') {
      for (const item of (<TextLink>obj).list) {
        retVal += extractText(item);
      }
    } else
    if (obj.type === 'span') {
      for (const item of (<TextSpan>obj).list) {
        retVal += extractText(item);
      }
    }
  }
  return retVal;
}

function processPara(para: TextParagraph, ctx: NavigationProcessContext, level: number) {
  let paraUrl;
  let paraContent = '';

  para.list = para.list.filter(item => {
    if (typeof item !== 'string') {
      return true;
    }
    return !!item.trim();
  });
  if (para.list.length === 0) {
    return;
  }

  const item = para.list[0];
  if (typeof item === 'string') {
    paraContent += extractText(item);
  } else
  if (item.type === 'link') {
    const link = <TextLink>item;
    paraUrl = link.href;
    paraContent += extractText(item);
  }

  if (paraContent) {
    ctx.lastContent = paraContent;
    const fileId = paraUrl ? urlToFolderId(paraUrl) : 'header_' + ctx.headerCounter++;

    ctx.levelParent[level] = fileId;

    const hierarchyFrontMatter: NavigationHierarchyNode = {
      identifier: fileId,
      name: paraContent.trim(),
      weight: ctx.counter
    };

    if (level > 0) {
      hierarchyFrontMatter.parent = ctx.levelParent[level - 1];
    }

    ctx.result[hierarchyFrontMatter.identifier] = hierarchyFrontMatter;
    ctx.counter += 10;

    if (!paraUrl) {
      ctx.logger.warn(`Warning: .navigation menu has "${paraContent.trim()}" without url near: "${ctx.lastContent.trim()}"`);
    }
  }
}

function processList(textList: TextList, ctx: NavigationProcessContext, level = 0) {
  for (const textListItem of textList.list) {
    for (const paraOrList of textListItem.list) {
      if (paraOrList.type === 'list') {
        processList(<TextList>paraOrList, ctx, level + 1);
        continue;
      }

      if (paraOrList.type === 'paragraph') {
        processPara(<TextParagraph>paraOrList, ctx, level);
        continue;
      }
    }

  }
}

// https://developers.google.com/docs/api/concepts/structure
export async function generateNavigationHierarchy(doc: DocumentContent, logger: Logger): Promise<NavigationHierarchy> {
  const ctx: NavigationProcessContext = {
    headerCounter: 1,
    counter: 30,
    levelParent: {},
    logger: logger,
    result: {},
    lastContent: 'START'
  };

  for (const structuralElement of doc.body.text.list) {
    if (structuralElement.type !== 'list') {
      continue;
    }

    const textList: TextList = <TextList>structuralElement;
    processList(textList, ctx);
  }

  return ctx.result;
}
