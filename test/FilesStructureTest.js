import { assert } from 'chai';
import { FilesStructure } from '../src/FilesStructure';

describe('FileStructure', () => {
  it('test collisions', () => {

    const filesStructure = new FilesStructure();

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

    filesStructure.merge(files1);

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

  it('test redirects', () => {

    const filesStructure = new FilesStructure();

    filesStructure.merge([{
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

    assert.equal(Object.keys(fileMap).length, 2);

    //////////////////////////////

    filesStructure.merge([{
        'id': 'id1',
        'name': 'Example 1',
        'mimeType': 'application/vnd.google-apps.document',
        'desiredLocalPath': 'container/example-1.md',
      },
      {
        'id': 'id2',
        'name': 'Example 2',
        'mimeType': 'application/vnd.google-apps.document',
        'desiredLocalPath': 'container/example-2.md',
      }
    ]);

    fileMap = filesStructure.getFileMap();

    assert.equal(Object.keys(fileMap).length, 4);

    let folderExample1 = filesStructure.findFile(file => file.desiredLocalPath === 'folder/example-1.md');
    let folderExample2 = filesStructure.findFile(file => file.desiredLocalPath === 'folder/example-2.md');
    let containerExample1 = filesStructure.findFile(file => file.desiredLocalPath === 'container/example-1.md');
    let containerExample2 = filesStructure.findFile(file => file.desiredLocalPath === 'container/example-2.md');

    assert.isNotEmpty(folderExample1);
    assert.isNotEmpty(folderExample2);
    assert.isNotEmpty(containerExample1);
    assert.isNotEmpty(containerExample2);

    assert.equal(folderExample1.mimeType, FilesStructure.REDIRECT_MIME, 'Incorrect mime folderExample1');
    assert.equal(folderExample1.localPath, 'folder/example-1.md');
    assert.equal(folderExample1.redirectTo, containerExample1.id);

    assert.equal(folderExample2.mimeType, FilesStructure.REDIRECT_MIME, 'Incorrect mime folderExample2');
    assert.equal(folderExample2.localPath, 'folder/example-2.md');
    assert.equal(folderExample2.redirectTo, containerExample2.id);

    assert.equal(containerExample1.mimeType, FilesStructure.DOCUMENT_MIME, 'Incorrect mime containerExample1');
    assert.equal(containerExample1.localPath, 'container/example-1.md');

    assert.equal(containerExample2.mimeType, FilesStructure.DOCUMENT_MIME, 'Incorrect mime containerExample2');
    assert.equal(containerExample2.localPath, 'container/example-2.md');

    //////////////////////////////

    filesStructure.merge([{
        'id': 'id1',
        'name': 'Sample 1',
        'mimeType': 'application/vnd.google-apps.document',
        'desiredLocalPath': 'container/sample-1.md',
      },
      {
        'id': 'id2',
        'name': 'Example 2',
        'mimeType': 'application/vnd.google-apps.document',
        'desiredLocalPath': 'container/example-2.md',
      }
    ]);

    fileMap = filesStructure.getFileMap();
    assert.equal(Object.keys(fileMap).length, 5);

    folderExample1 = filesStructure.findFile(file => file.desiredLocalPath === 'folder/example-1.md');
    folderExample2 = filesStructure.findFile(file => file.desiredLocalPath === 'folder/example-2.md');
    containerExample1 = filesStructure.findFile(file => file.desiredLocalPath === 'container/example-1.md');
    containerExample2 = filesStructure.findFile(file => file.desiredLocalPath === 'container/example-2.md');
    let containerSample1 = filesStructure.findFile(file => file.desiredLocalPath === 'container/sample-1.md');

    assert.equal(folderExample1.mimeType, FilesStructure.REDIRECT_MIME);
    assert.equal(folderExample1.localPath, 'folder/example-1.md');
    assert.equal(folderExample1.redirectTo, containerSample1.id);

    assert.equal(containerExample1.mimeType, FilesStructure.REDIRECT_MIME);
    assert.equal(containerExample1.localPath, 'container/example-1.md');
    assert.equal(containerExample1.redirectTo, containerSample1.id);

    assert.equal(containerSample1.mimeType, FilesStructure.DOCUMENT_MIME);
    assert.equal(containerSample1.localPath, 'container/sample-1.md');
  });
});