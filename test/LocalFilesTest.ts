import { assertStrictEquals } from 'asserts';

import {LocalFile, LocalFileMap} from '../src/model/LocalFile.ts';
import {solveConflicts} from '../src/containers/transform/TransformContainer.ts';
import {compareObjects} from './utils.ts';
import {MimeTypes} from '../src/model/GoogleFile.ts';

export function compareFiles(files1: LocalFileMap, files2: LocalFileMap) {
  for (const realFileName in files1) {
    delete files1[realFileName].modifiedTime;
  }
  for (const realFileName in files2) {
    delete files2[realFileName].modifiedTime;
  }

  assertStrictEquals(true, compareObjects(files1, files2));
}

Deno.test('test collisions', async () => {
  const files1: LocalFile[] = [
    {
      type: 'md',
      id: 'id1',
      title: 'test-file',
      fileName: 'test-file.md',
      lastAuthor: 'John Smith'
    },
    {
      type: 'md',
      id: 'id2',
      title: 'test-file',
      fileName: 'test-file.md',
      lastAuthor: 'John Smith'
    }
  ];

  const dbFiles = solveConflicts(files1, {});

  compareFiles(dbFiles, {
    'test-file.md': {
      type: 'conflict',
      id: 'conflict:test-file.md',
      title: 'Conflict: test-file',
      fileName: 'test-file.md',
      mimeType: MimeTypes.MARKDOWN,
      conflicting: [
        {
          id: 'id1',
          realFileName: 'test-file@1.md',
          title: 'test-file'
        },
        {
          id: 'id2',
          realFileName: 'test-file@2.md',
          title: 'test-file'
        }
      ]
    },
    'test-file@1.md': {
      type: 'md',
      id: 'id1',
      title: 'test-file',
      fileName: 'test-file.md',
      lastAuthor: 'John Smith'
    },
    'test-file@2.md': {
      type: 'md',
      id: 'id2',
      title: 'test-file',
      fileName: 'test-file.md',
      lastAuthor: 'John Smith'
    }
  });
});

Deno.test('test collision then trash', async () => {
  const files1: LocalFile[] = [
    {
      type: 'md',
      id: 'id1',
      title: 'example-1',
      fileName: 'example-1.md',
      lastAuthor: 'John Smith'
    },
    {
      type: 'md',
      id: 'id2',
      title: 'example-1',
      fileName: 'example-1.md',
      lastAuthor: 'John Smith'
    }
  ];

  const dbFiles1 = solveConflicts(files1, {});
  compareFiles(dbFiles1, {
    'example-1.md': {
      type: 'conflict',
      id: 'conflict:example-1.md',
      title: 'Conflict: example-1',
      fileName: 'example-1.md',
      mimeType: MimeTypes.MARKDOWN,
      conflicting: [
        {
          id: 'id1',
          realFileName: 'example-1@1.md',
          title: 'example-1'
        },
        {
          id: 'id2',
          realFileName: 'example-1@2.md',
          title: 'example-1'
        }
      ]
    },
    'example-1@1.md': {
      type: 'md',
      id: 'id1',
      title: 'example-1',
      fileName: 'example-1.md',
      lastAuthor: 'John Smith'
    },
    'example-1@2.md': {
      type: 'md',
      id: 'id2',
      title: 'example-1',
      fileName: 'example-1.md',
      lastAuthor: 'John Smith'
    }
  });

  const dbFiles2 = solveConflicts([
    {
      type: 'md',
      id: 'id1',
      title: 'example-1',
      fileName: 'example-1.md',
      lastAuthor: 'John Smith'
    },
    {
      type: 'md',
      id: 'id2',
      title: 'example-2',
      fileName: 'example-2.md',
      lastAuthor: 'John Smith'
    },
  ], dbFiles1);

  compareFiles(dbFiles2, {
    'example-1.md': {
      type: 'md',
      id: 'id1',
      title: 'example-1',
      fileName: 'example-1.md',
      lastAuthor: 'John Smith'
    },
    'example-2.md': {
      type: 'md',
      id: 'id2',
      title: 'example-2',
      fileName: 'example-2.md',
      lastAuthor: 'John Smith'
    }
  });
});
