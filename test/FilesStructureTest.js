import { assert } from 'chai';
import { FilesStructure } from '../src/storage/FilesStructure';
import {createTmpDir} from './utils';

describe('FileStructure', () => {
  it('test collisions', async () => {

    const filesStructure = new FilesStructure(createTmpDir());
    await filesStructure.init();

    const files1 = [{
        'id': 'id1',
        'name': 'Test file',
        'mimeType': 'application/vnd.google-apps.document',
        'desiredLocalPath': 'test-file.md',
      },
      {
        'id': 'id2',
        'name': 'Test file',
        'mimeType': 'application/vnd.google-apps.document',
        'desiredLocalPath': 'test-file.md',
      }
    ];

    await filesStructure.merge(files1);

    const fileMap = filesStructure.getFileMap();

    assert.equal(Object.keys(fileMap).length, 3);

    const conflictFile = filesStructure.findFile(file => file.mimeType === FilesStructure.CONFLICT_MIME);
    const file1 = filesStructure.findFile(file => file.mimeType !== FilesStructure.CONFLICT_MIME && file.localPath === 'test-file_1.md');
    const file2 = filesStructure.findFile(file => file.mimeType !== FilesStructure.CONFLICT_MIME && file.localPath === 'test-file_2.md');

    assert.notEmpty(conflictFile);
    assert.notEmpty(file1);
    assert.notEmpty(file2);

    assert.equal(conflictFile.name, 'Test file');
    assert.equal(conflictFile.desiredLocalPath, 'test-file.md');

    assert.equal(file1.name, 'Test file');
    assert.equal(file1.desiredLocalPath, 'test-file.md');

    assert.equal(file2.name, 'Test file');
    assert.equal(file2.desiredLocalPath, 'test-file.md');
  });

  it('test redirects', async () => {

    const filesStructure = new FilesStructure(createTmpDir());
    await filesStructure.init();

    await filesStructure.merge([{
        'id': 'id1',
        'name': 'Example 1',
        'mimeType': 'application/vnd.google-apps.document',
        'desiredLocalPath': 'folder/example-1.md',
      },
      {
        'id': 'id2',
        'name': 'Example 2',
        'mimeType': 'application/vnd.google-apps.document',
        'desiredLocalPath': 'folder/example-2.md',
      }
    ]);

    let fileMap = filesStructure.getFileMap();

    assert.equal(Object.keys(fileMap).length, 2, 'Wrong number of files');

    //////////////////////////////

    await filesStructure.merge([{
        'id': 'id1',
        'name': 'Example 1 renamed',
        'mimeType': 'application/vnd.google-apps.document',
      },
      {
        'id': 'id2',
        'name': 'Example 2 renamed',
        'mimeType': 'application/vnd.google-apps.document',
      }
    ]);

    fileMap = filesStructure.getFileMap();

    assert.equal(Object.keys(fileMap).length, 4, 'Wrong number of redirects');

    let folderExample1 = filesStructure.findFile(file => file.desiredLocalPath === 'example-1.md');
    let folderExample2 = filesStructure.findFile(file => file.desiredLocalPath === 'example-2.md');
    let containerExample1 = filesStructure.findFile(file => file.desiredLocalPath === 'example-1-renamed.md');
    let containerExample2 = filesStructure.findFile(file => file.desiredLocalPath === 'example-2-renamed.md');

    assert.isNotEmpty(folderExample1);
    assert.isNotEmpty(folderExample2);
    assert.isNotEmpty(containerExample1);
    assert.isNotEmpty(containerExample2);

    assert.equal(folderExample1.mimeType, FilesStructure.REDIRECT_MIME, 'Incorrect mime folderExample1');
    assert.equal(folderExample1.localPath, 'example-1.md');
    assert.equal(folderExample1.redirectTo, containerExample1.id);

    assert.equal(folderExample2.mimeType, FilesStructure.REDIRECT_MIME, 'Incorrect mime folderExample2');
    assert.equal(folderExample2.localPath, 'example-2.md');
    assert.equal(folderExample2.redirectTo, containerExample2.id);

    assert.equal(containerExample1.mimeType, FilesStructure.DOCUMENT_MIME, 'Incorrect mime containerExample1');
    assert.equal(containerExample1.localPath, 'example-1-renamed.md');

    assert.equal(containerExample2.mimeType, FilesStructure.DOCUMENT_MIME, 'Incorrect mime containerExample2');
    assert.equal(containerExample2.localPath, 'example-2-renamed.md');

    //////////////////////////////

    await filesStructure.merge([{
        'id': 'id1',
        'name': 'Sample 1 renamed',
        'mimeType': 'application/vnd.google-apps.document'
      },
      {
        'id': 'id2',
        'name': 'Example 2 renamed',
        'mimeType': 'application/vnd.google-apps.document'
      }
    ]);

    fileMap = filesStructure.getFileMap();
    assert.equal(Object.keys(fileMap).length, 5);

    folderExample1 = filesStructure.findFile(file => file.desiredLocalPath === 'example-1.md');
    folderExample2 = filesStructure.findFile(file => file.desiredLocalPath === 'example-2.md');
    containerExample1 = filesStructure.findFile(file => file.desiredLocalPath === 'example-1-renamed.md');
    containerExample2 = filesStructure.findFile(file => file.desiredLocalPath === 'example-2-renamed.md');
    let containerSample1 = filesStructure.findFile(file => file.desiredLocalPath === 'sample-1-renamed.md');

    assert.equal(folderExample1.mimeType, FilesStructure.REDIRECT_MIME);
    assert.equal(folderExample1.localPath, 'example-1.md');
    assert.equal(folderExample1.redirectTo, containerSample1.id);

    assert.equal(containerExample1.mimeType, FilesStructure.REDIRECT_MIME);
    assert.equal(containerExample1.localPath, 'example-1-renamed.md');
    assert.equal(containerExample1.redirectTo, containerSample1.id);

    assert.equal(containerSample1.mimeType, FilesStructure.DOCUMENT_MIME);
    assert.equal(containerSample1.localPath, 'sample-1-renamed.md');
  });
});
