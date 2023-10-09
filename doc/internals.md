# Internals

## File Structure on Server

/data (in container, but configurable on the command line)

* folders.json - a listing of each google shared folder
* One folder for each drive
    * Second folder with the same name with `_transform` on the end to hold markdown version
* quota.json - google throttle for limited rate

```
/data# more folders.json
{
  "0APmwe3yIhGabUk9PVA": {
    "id": "0APmwe3yIhGabUk9PVA",
    "name": "A Test WikiGDrive"
  },
}

/data/0APmwe3yIhGabUk9PVA# tree -a
.
|-- .drive.json                  # delete this
|-- .folder-files.json           # Each file - coming from google API
|-- .folder.json                 # https://github.com/mieweb/wikiGDrive/blob/8609077ee14501c80acbd97a61c9fbdfbb0fc6fc/src/containers/google_folder/TaskFetchFolder.ts#L68
|-- .tree.json                   # a listin of all the files
|-- 1KZ45LytrvLZ3Np_EC_x5Uv6fy8xHLhvJyDNfC6i4xtc.odt
`-- 1wlRv3bZ5Z84TD9Oba4-lEorfV_R9aKhJyRS2iCInA7w.odt
|-- .user_config.yaml
|-- .private
|   |-- id_rsa
|   `-- id_rsa.pub

/data/0APmwe3yIhGabUk9PVA_transform# tree -a
|-- .git.json
|-- .gitignore
|-- .tree.json
|-- .wgd-directory.yaml
|-- .wgd-local-links.csv
|-- .wgd-local-log.csv
|-- example-folder
|   |-- .wgd-directory.yaml
|   `-- 1
|       |-- .wgd-directory.yaml
|       `-- 2
|           |-- .wgd-directory.yaml
|           `-- 3
|               |-- .wgd-directory.yaml
|               `-- 4
|                   |-- .wgd-directory.yaml
|                   |-- sub-folder-example-file.assets
|                   |-- sub-folder-example-file.debug.xml
|                   `-- sub-folder-example-file.md
|-- index.assets
|-- index.debug.xml
|-- index.md
|-- readme.assets
|-- readme.debug.xml
`-- readme.md
```

## .wgd dir structure

### drive.json:

```
{
  "drive": "https://drive.google.com/drive/folders/FOLDER_ID",
  "dest": "/home/user/mieweb/wikigdrive-test",
  "link_mode": "mdURLs",
  "service_account": "wikigdrive.json"
}
```

### google_files.json is indexed with Google's fileId - data got from google (just adding parentId, simplify lastAuthor)

## Note this is going away.  Will be replacing this single database with a multi-file version for scale.

- id - Google's fileId
- name - Title set inside google docs. It is not unique
- mimeType - Google's mime type or 'conflict' or 'redirect'
- modifiedTime - Server-size mtime
- localPath - real local path, unique with handled conflicts and redirects (in case of title rename)
- lastAuthor - Google's last author if available

```
{
    "123123123": {
        "id": "123123123",
        "name": "A title of document",
        "mimeType": "application/vnd.google-apps.document",
        "modifiedTime": "2020-02-27T20:20:20.123Z",
        "desiredLocalPath": "a-title-of-document",
        "lastAuthor": "John Smith",
    }
}
```

### download.json is indexed with Google's fileId - it contains gdoc JSON sources, svg for diagrams and zip with images:

```
{
  "123123": {
    "id": "123123",
    "name": "System Conversion",
    "mimeType": "application/vnd.google-apps.document",
    "modifiedTime": "2020-02-27T21:31:21.718Z",
    "images": [
      {
        "docUrl": "i.0",
        "pngUrl": "https://lh6.googleusercontent.com/123123123123",
        "zipImage": {
          "zipPath": "image1.png",
          "width": 704,
          "height": 276,
          "hash": "0000001101010111101111010010101001010110001011101000111100110111"
        }
      }
    ]
  }
}
```

### local_files.json is indexed with file id

- desiredLocalPath - slugified name. It is not unique, wikigdrive handles redirects so it is NOT real path in local system
- dirty - file needs to be downloaded
- conflicting - array of fileIds when mimeType = 'conflict'
- localPath - path to transformed markdown file
- modifiedTime - fetched from google server

```
{
    "123123123": {
        "localPath": "a-title-of-document"
        "localPath": "external_path/123123123.png",
        "md5Checksum": "123123123"
    }
}
```

## Conflict resolution and redirect algorithm

### Sync stage: get files from google by listening root directory or watching changes - save into google_files.json

### Download stage: download all files that does not exist in download.json - save into download.json

### Transform stage:

0. Get files to transform (does not exist in local_files.json, have different modifiedTime, are trashed), generate desireLocalPaths based on parents
1. If file is removed - remove .md file, remove images
2. If file is new (not exists in local_files.json) - add to localFiles, schedule for generation
3. If file exists but with different desireLocalPath:
   3.1. Remove old .md, remove old images
   3.2. Schedule for generation
   3.3. Generate redir with old localPath
4. Remove dangling redirects
5. Check if there are any conflicts (same desireLocalPath)
6. Check if any conflicts can be removed
