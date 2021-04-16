import {assert} from 'chai';
import {LocalFile, LocalFilesStorage} from '../src/storage/LocalFilesStorage';
import {createTmpDir} from './utils';

export function compareFiles(files1: LocalFile[], files2: LocalFile[]) {
  assert.equal(files1.length, files2.length, 'length not equal');

  for (const file1 of files1) {
    if (files2.filter(file2 => file2.id === file1.id).length !== 1) {
      assert.ok(false, 'length2 not equal' + file1.id);
      return false;
    }

    const file2 = files2.find(file2 => file2.id === file1.id);
    assert.deepEqual(file1, file2);
  }
}


describe('LocalFiles', () => {
  it('test collisions', async () => {

    const localFilesStorage = new LocalFilesStorage(createTmpDir());
    await localFilesStorage.init();

    const files1: LocalFile[] = [
      {
        id: 'id1',
        name: 'test-file',
        desiredLocalPath: 'test-file',
      },
      {
        id: 'id2',
        name: 'test-file',
        desiredLocalPath: 'test-file',
      }
    ];

    await localFilesStorage.commit(files1);

    const dbFiles = localFilesStorage.findFiles(() => true);

    compareFiles(dbFiles, [
      {
        id: 'test-file:conflict',
        name: 'Conflict: test-file',
        desiredLocalPath: 'test-file',
        localPath: 'test-file',
        counter: 3,
        conflicting: ['id1', 'id2']
      },
      {
        id: 'id1',
        name: 'test-file',
        desiredLocalPath: 'test-file',
        conflictId: "test-file:conflict",
        localPath: 'test-file_1',
        counter: 1,
        modifiedTime: undefined
      },
      {
        id: 'id2',
        name: 'test-file',
        desiredLocalPath: 'test-file',
        conflictId: "test-file:conflict",
        localPath: 'test-file_2',
        counter: 2,
        modifiedTime: undefined
      }
    ]);

    await localFilesStorage.destroy();
  });

  it('test redirects', async () => {
    const localFilesStorage = new LocalFilesStorage(createTmpDir());
    await localFilesStorage.init();

    await localFilesStorage.commit([
      {
        id: 'id1',
        name: 'example-1',
        desiredLocalPath: 'example-1',
      },
      {
        id: 'id2',
        name: 'example-2',
        desiredLocalPath: 'example-2',
      }
    ]);

    {
      const dbFiles = localFilesStorage.findFiles(() => true);
      compareFiles(dbFiles, [
        {
          id: 'id1',
          name: 'example-1',
          desiredLocalPath: 'example-1',
          localPath: "example-1",
          modifiedTime: undefined
        },
        {
          id: 'id2',
          name: 'example-2',
          desiredLocalPath: 'example-2',
          localPath: "example-2",
          modifiedTime: undefined
        }
      ]);
    }

    await localFilesStorage.commit([
      {
        id: 'id1',
        name: 'example-1-renamed',
        desiredLocalPath: 'example-1-renamed',
      },
      {
        id: 'id2',
        name: 'example-2-renamed',
        desiredLocalPath: 'example-2-renamed',
      }
    ]);

    {
      const dbFiles = localFilesStorage.findFiles(() => true);
      compareFiles(dbFiles, [
        {
          id: 'example-1:redir:id1',
          redirectTo: 'id1',
          name: 'example-1',
          desiredLocalPath: 'example-1',
          localPath: "example-1",
          modifiedTime: undefined
        },
        {
          id: 'example-2:redir:id2',
          redirectTo: 'id2',
          name: 'example-2',
          desiredLocalPath: 'example-2',
          localPath: "example-2",
          modifiedTime: undefined
        },
        {
          id: 'id1',
          name: 'example-1-renamed',
          desiredLocalPath: 'example-1-renamed',
          localPath: 'example-1-renamed',
          modifiedTime: undefined
        },
        {
          id: 'id2',
          desiredLocalPath: 'example-2-renamed',
          name: 'example-2-renamed',
          localPath: 'example-2-renamed',
          modifiedTime: undefined
        }
      ]);
    }

    await localFilesStorage.destroy();
  });

  it('test rename then trash', async () => {
    const localFilesStorage = new LocalFilesStorage(createTmpDir());
    await localFilesStorage.init();

    await localFilesStorage.commit([
      {
        id: 'id1',
        name: 'example-1',
        desiredLocalPath: 'example-1',
      },
    ]);

    {
      const dbFiles = localFilesStorage.findFiles(() => true);
      assert.equal(Object.keys(dbFiles).length, 1, 'Wrong number of files');
    }

    await localFilesStorage.commit([
      {
        id: 'id1',
        name: 'renamed-example-1',
        desiredLocalPath: 'renamed-example-1',
      },
    ]);

    {
      const dbFiles = localFilesStorage.findFiles(() => true);
      compareFiles(dbFiles, [
        {
          id: 'example-1:redir:id1',
          redirectTo: 'id1',
          localPath: 'example-1',
          name: 'example-1',
          desiredLocalPath: 'example-1',
          modifiedTime: undefined
        },
        {
          id: 'id1',
          desiredLocalPath: 'renamed-example-1',
          name: 'renamed-example-1',
          localPath: 'renamed-example-1',
          modifiedTime: undefined
        },
      ]);
    }

    await localFilesStorage.commit([
      // delete id1
    ]);

    {
      const dbFiles = localFilesStorage.findFiles(() => true);
      assert.equal(Object.keys(dbFiles).length, 0, 'Wrong number of files');
    }

    await localFilesStorage.destroy();
  });

  it('test create then trash', async () => {
    const localFilesStorage = new LocalFilesStorage(createTmpDir());
    await localFilesStorage.init();

    await localFilesStorage.commit([
      {
        id: 'id1',
        name: 'example-1',
        desiredLocalPath: 'example-1',
      },
    ]);

    {
      const dbFiles = localFilesStorage.findFiles(() => true);
      assert.equal(Object.keys(dbFiles).length, 1, 'Wrong number of files');
    }

    await localFilesStorage.commit([]);

    {
      const dbFiles = localFilesStorage.findFiles(() => true);
      assert.equal(Object.keys(dbFiles).length, 0, 'Wrong number of files');
    }

    await localFilesStorage.destroy();
  });


  it('test collision then trash', async () => {
    const localFilesStorage = new LocalFilesStorage(createTmpDir());
    await localFilesStorage.init();

    await localFilesStorage.commit([
      {
        id: 'id1',
        name: 'example-1',
        desiredLocalPath: 'example-1',
      },
      {
        id: 'id2',
        name: 'example-1',
        desiredLocalPath: 'example-1',
      }
    ]);

    {
      const dbFiles = localFilesStorage.findFiles(() => true);
      compareFiles(dbFiles, [
        {
          id: 'example-1:conflict',
          name: 'Conflict: example-1',
          desiredLocalPath: 'example-1',
          localPath: 'example-1',
          counter: 3,
          conflicting: ['id1', 'id2']
        },
        {
          id: 'id1',
          name: 'example-1',
          desiredLocalPath: 'example-1',
          localPath: 'example-1_1',
          conflictId: "example-1:conflict",
          counter: 1,
          modifiedTime: undefined
        },
        {
          id: 'id2',
          name: 'example-1',
          desiredLocalPath: 'example-1',
          localPath: 'example-1_2',
          conflictId: "example-1:conflict",
          counter: 2,
          modifiedTime: undefined
        }
      ]);
    }

    await localFilesStorage.commit([
      {
        id: 'id2',
        name: 'example-1',
        desiredLocalPath: 'example-1',
      },
    ]);

    {
      const dbFiles = localFilesStorage.findFiles(() => true);
      compareFiles(dbFiles, [
        {
          id: 'id2',
          name: 'example-1',
          desiredLocalPath: 'example-1',
          localPath: 'example-1',
          modifiedTime: undefined
        },
        {
          id: 'example-1_2:redir:id2',
          redirectTo: 'id2',
          name: 'example-1',
          desiredLocalPath: 'example-1_2',
          localPath: 'example-1_2',
          modifiedTime: undefined
        }
      ]);
    }

    await localFilesStorage.destroy();
  });

});
