'use strict';

import {LocalFile} from './storage/LocalFilesStorage';
import {docs_v1} from 'googleapis';
import Schema$Document = docs_v1.Schema$Document;
import {urlToFolderId} from './utils/idParsers';

export interface NavigationHierarchyNode {
  name: string;
  weight: number;
  identifier: string;
  parent?: string;
}

export interface NavigationHierarchy {
  [k: string]: NavigationHierarchyNode;
}

// https://developers.google.com/docs/api/concepts/structure
export async function generateNavigationHierarchy(doc: Schema$Document, files: LocalFile[]): Promise<NavigationHierarchy> {
  const result: NavigationHierarchy = {};

  let counter = 30;
  let lastcontent = '';

  const levelParent = {};

  for (const structuralElement of doc.body.content) {
    if (!structuralElement.paragraph?.elements) {
      continue;
    }

    const level = structuralElement?.paragraph?.bullet?.nestingLevel || 0;

    for (const element of structuralElement.paragraph.elements) {
      const content = element?.textRun?.content;
      const url = element?.textRun?.textStyle.link?.url;

      if (content && url) {
        lastcontent = content;
        const fileId = urlToFolderId(url);

        const desiredPath = '/' + url.split('.')[0];
        const file = files.find(file => file.id === fileId || file.desiredLocalPath.split('.')[0] === desiredPath || file.desiredLocalPath === url);

        if (file) {
          levelParent[level] = file.id;

          const hierarchyFrontMatter: NavigationHierarchyNode = {
            identifier: file.id,
            name: content,
            weight: counter
          };

          if (level > 0) {
            hierarchyFrontMatter.parent = levelParent[level - 1];
          }

          result[hierarchyFrontMatter.identifier] = hierarchyFrontMatter;
          counter += 10;
        }
      } else if (content != '\n') {
        console.log('Warning: .navigation menu has ' + content.trim() + ' without url near: ' + lastcontent.trim());
      }
    }
  }

  return result;
}
