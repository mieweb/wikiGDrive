import { assert } from 'chai';
import {GoogleFiles, MimeTypes} from '../src/storage/GoogleFiles';
import {createTmpDir} from './utils';

describe('FileStructure', () => {
/*
  it('test collisions', async () => {

    const googleFiles = new googleFiles(createTmpDir());
    await googleFiles.init();

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

    await googleFiles.merge(files1);

    const fileMap = googleFiles.getFileMap();

    assert.equal(Object.keys(fileMap).length, 3);

    const conflictFile = googleFiles.findFile(file => file.mimeType === MimeTypes.CONFLICT_MIME);
    const file1 = googleFiles.findFile(file => file.mimeType !== MimeTypes.CONFLICT_MIME && file.localPath === 'test-file_1.md');
    const file2 = googleFiles.findFile(file => file.mimeType !== MimeTypes.CONFLICT_MIME && file.localPath === 'test-file_2.md');

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

    const googleFiles = new googleFiles(createTmpDir());
    await googleFiles.init();

    await googleFiles.merge([{
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

    let fileMap = googleFiles.getFileMap();

    assert.equal(Object.keys(fileMap).length, 2, 'Wrong number of files');

    //////////////////////////////

    await googleFiles.merge([{
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

    fileMap = googleFiles.getFileMap();

    assert.equal(Object.keys(fileMap).length, 4, 'Wrong number of redirects');

    let folderExample1 = googleFiles.findFile(file => file.desiredLocalPath === 'example-1.md');
    let folderExample2 = googleFiles.findFile(file => file.desiredLocalPath === 'example-2.md');
    let containerExample1 = googleFiles.findFile(file => file.desiredLocalPath === 'example-1-renamed.md');
    let containerExample2 = googleFiles.findFile(file => file.desiredLocalPath === 'example-2-renamed.md');

    assert.isNotEmpty(folderExample1);
    assert.isNotEmpty(folderExample2);
    assert.isNotEmpty(containerExample1);
    assert.isNotEmpty(containerExample2);

    assert.equal(folderExample1.mimeType, MimeTypes.REDIRECT_MIME, 'Incorrect mime folderExample1');
    assert.equal(folderExample1.localPath, 'example-1.md');
    assert.equal(folderExample1.redirectTo, containerExample1.id);

    assert.equal(folderExample2.mimeType, MimeTypes.REDIRECT_MIME, 'Incorrect mime folderExample2');
    assert.equal(folderExample2.localPath, 'example-2.md');
    assert.equal(folderExample2.redirectTo, containerExample2.id);

    assert.equal(containerExample1.mimeType, MimeTypes.DOCUMENT_MIME, 'Incorrect mime containerExample1');
    assert.equal(containerExample1.localPath, 'example-1-renamed.md');

    assert.equal(containerExample2.mimeType, MimeTypes.DOCUMENT_MIME, 'Incorrect mime containerExample2');
    assert.equal(containerExample2.localPath, 'example-2-renamed.md');

    //////////////////////////////

    await googleFiles.merge([{
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

    fileMap = googleFiles.getFileMap();
    assert.equal(Object.keys(fileMap).length, 5);

    folderExample1 = googleFiles.findFile(file => file.desiredLocalPath === 'example-1.md');
    folderExample2 = googleFiles.findFile(file => file.desiredLocalPath === 'example-2.md');
    containerExample1 = googleFiles.findFile(file => file.desiredLocalPath === 'example-1-renamed.md');
    containerExample2 = googleFiles.findFile(file => file.desiredLocalPath === 'example-2-renamed.md');
    let containerSample1 = googleFiles.findFile(file => file.desiredLocalPath === 'sample-1-renamed.md');

    assert.equal(folderExample1.mimeType, MimeTypes.REDIRECT_MIME);
    assert.equal(folderExample1.localPath, 'example-1.md');
    assert.equal(folderExample1.redirectTo, containerSample1.id);

    assert.equal(containerExample1.mimeType, MimeTypes.REDIRECT_MIME);
    assert.equal(containerExample1.localPath, 'example-1-renamed.md');
    assert.equal(containerExample1.redirectTo, containerSample1.id);

    assert.equal(containerSample1.mimeType, MimeTypes.DOCUMENT_MIME);
    assert.equal(containerSample1.localPath, 'sample-1-renamed.md');
  });
*/

  it('test rename then trash', async () => {
    let example1, example2, redir;

    const googleFiles = new GoogleFiles(createTmpDir());
    await googleFiles.init();

    await googleFiles.merge([
      {
        'id': 'id1',
        'name': 'Example 1',
        'mimeType': MimeTypes.DOCUMENT_MIME,
        'desiredLocalPath': 'example-1.md',
      },
    ]);

    let fileMap = googleFiles.getFileMap();
    assert.equal(Object.keys(fileMap).length, 1, 'Wrong number of files');


    await googleFiles.merge([
      {
        'id': 'id1',
        'name': 'Example 1',
        'mimeType': MimeTypes.DOCUMENT_MIME,
        'desiredLocalPath': 'renamed-example-1.md',
      },
    ]);

    fileMap = googleFiles.getFileMap();
    assert.equal(Object.keys(fileMap).length, 2, 'Wrong number of files');

    example1 = googleFiles.findFile(file => file.id === 'id1');
    assert.equal(example1.localPath, 'renamed-example-1.md');

    redir = googleFiles.findFile(file => file.mimeType === MimeTypes.REDIRECT_MIME);
    assert.equal(redir.localPath, 'example-1.md');

    await googleFiles.merge([
      {
        'trashed': true,
        'id': 'id1'
      },
    ]);

    fileMap = googleFiles.getFileMap();
    assert.equal(Object.keys(fileMap).length, 2, 'Wrong number of files');

    example1 = googleFiles.findFile(file => file.id === 'id1');
    assert.equal(example1.localPath, 'renamed-example-1.md');
    assert.equal(example1.trashed, true);

    redir = googleFiles.findFile(file => file.mimeType === MimeTypes.REDIRECT_MIME);
    assert.equal(redir.localPath, 'example-1.md');
    assert.equal(redir.trashed, true);

    await googleFiles.merge([
      {
        'id': 'id2',
        'name': 'Example 2',
        'mimeType': MimeTypes.DOCUMENT_MIME,
        'desiredLocalPath': 'example-1.md',
      },
    ]);

    fileMap = googleFiles.getFileMap();
    assert.equal(Object.keys(fileMap).length, 2, 'Wrong number of files');

    example1 = googleFiles.findFile(file => file.id === 'id1');
    assert.equal(example1.localPath, 'renamed-example-1.md');
    assert.equal(example1.trashed, true);

    example2 = googleFiles.findFile(file => file.id === 'id2');
    assert.equal(example2.localPath, 'example-1.md');
    assert.equal(example2.trashed, false);


    await googleFiles.merge([
      {
        'id': 'id3',
        'name': 'Example 3',
        'mimeType': MimeTypes.DOCUMENT_MIME,
        'desiredLocalPath': 'renamed-example-1.md',
      },
    ]);

    fileMap = googleFiles.getFileMap();
    assert.equal(Object.keys(fileMap).length, 3, 'Wrong number of files');

    example1 = googleFiles.findFile(file => file.id === 'id1');
    assert.equal(example1.localPath, null);
    assert.equal(example1.trashed, true);

    example2 = googleFiles.findFile(file => file.id === 'id2');
    assert.equal(example2.localPath, 'example-1.md');
    assert.equal(example2.trashed, false);

    example1 = googleFiles.findFile(file => file.id === 'id3');
    assert.equal(example1.localPath, 'renamed-example-1.md');
    assert.equal(example1.trashed, true);
  });

  it('test create then trash', async () => {
    const googleFiles = new GoogleFiles(createTmpDir());
    await googleFiles.init();

    await googleFiles.merge([
      {
        'id': 'id1',
        'name': 'Example 1',
        'mimeType': MimeTypes.DOCUMENT_MIME,
        'desiredLocalPath': 'example-1.md',
      },
    ]);

    let fileMap = googleFiles.getFileMap();
    assert.equal(Object.keys(fileMap).length, 1, 'Wrong number of files');

    await googleFiles.merge([
      {
        'trashed': true,
        'id': 'id1',
        'name': 'Example 1',
        'mimeType': MimeTypes.DOCUMENT_MIME,
        'desiredLocalPath': 'example-1.md',
      },
    ]);

    fileMap = googleFiles.getFileMap();
    assert.equal(Object.keys(fileMap).length, 1, 'Wrong number of files');

    const example1 = googleFiles.findFile(file => file.id === 'id1');
    assert.equal(example1.mimeType, MimeTypes.DOCUMENT_MIME);
    assert.equal(example1.trashed, true);
    assert.equal(example1.localPath, 'example-1.md'); // if no collision then path is present, this way transform will delete generated file
  });


  it('test collision then trash', async () => {
    let example1, example2, conflict, redir;

    const googleFiles = new GoogleFiles(createTmpDir());
    await googleFiles.init();

    await googleFiles.merge([
      {
        'id': 'id1',
        'name': 'Example 1',
        'mimeType': MimeTypes.DOCUMENT_MIME,
        'desiredLocalPath': 'example-1.md',
      },
      {
        'id': 'id2',
        'name': 'Example 1',
        'mimeType': MimeTypes.DOCUMENT_MIME,
        'desiredLocalPath': 'example-1.md',
      }
    ]);

    let fileMap = googleFiles.getFileMap();

    assert.equal(Object.keys(fileMap).length, 3, 'Wrong number of files');

    example1 = googleFiles.findFile(file => file.id === 'id1');
    assert.equal(example1.localPath, 'example-1-2.md');

    example2 = googleFiles.findFile(file => file.id === 'id2');
    assert.equal(example2.localPath, 'example-1-2.md');

    conflict = googleFiles.findFile(file => file.mimeType === MimeTypes.CONFLICT_MIME);
    assert.equal(conflict.localPath, 'example-1.md');

    await googleFiles.merge([
      {
        'trashed': true,
        'id': 'id1',
        'name': 'Example 1',
        'mimeType': MimeTypes.DOCUMENT_MIME,
        'desiredLocalPath': 'example-1.md',
      },
    ]);

    assert.equal(Object.keys(fileMap).length, 3, 'Wrong number of files');

    example1 = googleFiles.findFile(file => file.id === 'id1');

    assert.equal(example1.mimeType, MimeTypes.DOCUMENT_MIME);
    assert.equal(example1.trashed, true);
    assert.equal(example1.localPath, null);

    example2 = googleFiles.findFile(file => file.id === 'id2');
    assert.equal(example2.mimeType, MimeTypes.DOCUMENT_MIME);

    redir = googleFiles.findFile(file => file.mimeType === MimeTypes.REDIRECT_MIME);
    assert.equal(redir.localPath, 'example-1_2.md');

    //////////////////////////////
  });

});
