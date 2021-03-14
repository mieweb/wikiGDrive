# wikiGDrive

Google Drive to MarkDown synchronization

[![CircleCI](https://circleci.com/gh/mieweb/wikiGDrive.svg?style=svg)](https://circleci.com/gh/mieweb/wikiGDrive)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/mieweb/wikiGDrive.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/mieweb/wikiGDrive/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/mieweb/wikiGDrive.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/mieweb/wikiGDrive/context:javascript)
[![Project Dependencies](https://david-dm.org/mieweb/wikiGDrive.svg)](https://david-dm.org/mieweb/wikiGDrive)
[![devDependencies Status](https://david-dm.org/mieweb/wikiGDrive/dev-status.svg)](https://david-dm.org/mieweb/wikiGDrive?type=dev)

## Building from source
See [Node setup on the system](#Node-setup-on-the-system) for prereq.
```
npm install
npm run build
npm link --local
```

## Debugging

To get proper sourcemap support we suggest using ts-node for running.

1. Install ndb: `npm install -g ndb`
2. Install ts-node: `npm install -g ts-node`
3. Now you can run it with: `ndb node -r ts-node/register ./src/index.ts ...`
3. Or you can run it with: `ndb node -r ts-node/register/transpile-only ./src/index.ts --dest $DIR pull`
4. Or without the debugger just by `ts-node-transpile-only --project ./src/index.ts pull --dest $DIR pull`

## Install from NPM

[![View this project on NPM](https://img.shields.io/npm/v/@mieweb/wikigdrive.svg)](https://www.npmjs.com/package/@mieweb/wikigdrive)
[![NPM downloads](https://img.shields.io/npm/dm/@mieweb/wikigdrive.svg)](https://www.npmjs.com/package/@mieweb/wikigdrive)
![Publish wikigdrive to NPM](https://github.com/mieweb/wikiGDrive/workflows/Publish%20wikigdrive%20to%20NPM/badge.svg)
```
npm i -g @mieweb/wikigdrive
```

## App setup

1. Go to console https://console.developers.google.com/
2. Create New Project 
2. Enable Apis -> add Google Drive API
3. Enable Apis -> Add Google Docs API
4. Credentials ->  Create Credentials (OAuth Client ID) -> Other ( see authorization section )

## Usage and options

Init workdir with (creates internal .wgd directory):

```
wikigdrive init --drive "https://drive.google.com/drive/folders/FOLDER_ID"

--service_account=wikigdrive.json
--config /location/of/.wgd - Location of config file
--dest /location/of/downloaded/content - Destination for downloaded and converted markdown files

--drive_id - An ID of the drive

--client_id - ID of google app, alternatively can be passed in .env or through environment variable CLIENT_ID;
--client_secret - Secret of google app, alternatively can be passed in .env or through environment variable CLIENT_SECRET;

--link_mode - Style of internal markdown links
--link_mode mdURLs - `/filename.md`
--link_mode dirURLs - `/filename/`
--link_mode uglyURLs - `/filename.html` - see https://gohugo.io/getting-started/configuration/

--without-folder-structure    Download documents into single, flat folder
```

List available drive ids

```
wikigdrive drives
```

Run one time documents pull

```
wikigdrive pull
```

Run continuous documents watch

```
wikigdrive watch --git_update_delay=10

--watch [mtime|changes] - Run program in loop, watch for gdrive changes
--git_update_delay=x - trigger git update hook after x minutes
```

Run server mode for webhooks support (TODO: not implemented yet)

```
wikigdrive server
```

## Example usage with Hugo Generator

1. Install hugo https://gohugo.io/getting-started/quick-start/

2. Create a New Site

```
hugo new site quickstart
```

3. Add a Theme

```
cd quickstart
git init
git submodule add https://github.com/budparr/gohugo-theme-ananke.git themes/ananke
echo 'theme = "ananke"' >> config.toml
```

4. Install wikigdrive

```
npm i -g @mieweb/wikigdrive
```

5. Sync GDrive

```
wikigdrive init --drive "https://drive.google.com/drive/folders/FOLDER_ID" --dest ./content --link_mode uglyURLs
wikigdrive pull
```

Note that by default you need to use `uglyURLs` with Hugo. https://gohugo.io/content-management/urls/#ugly-urls

6. Generate HTML

```
hugo
```

or start server for development:

```
hugo server
```

## Example usage with Hexo Generator

1. Install hexo https://hexo.io/docs/index.html

```
npm i -g hexo-cli
```

2. Create a New Site

```
hexo init quickstart
```

3. Add a Theme

By default, hexo installs `landscape` theme. If you need another one check: https://hexo.io/docs/themes

4. Install wikigdrive

```
npm i -g @mieweb/wikigdrive
```

5. Sync GDrive

```
wikigdrive init --drive "https://drive.google.com/drive/folders/FOLDER_ID" --dest ./source --link_mode uglyURLs
wikigdrive pull
```

6. Generate HTML

```
hexo generate
```

or start server for development:

```
hexo serve
```

## Authorization

There are two methods: individual credentials or a service account.

- [Individual](https://cloud.google.com/docs/authentication/end-user#creating_your_client_credentials)
- [Service Account](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority)

***Note: If the authentication is successful, but the account does not have access to documents in gdrive, there is currently no way to know if the directory is empty or just not possible to see.

## FAQ

### What is the purpose of this tool?

To enable collaborative editing of documentation and the ability to publish that documentation as well as linking it to revision control system branches (like in git)

### Why use Google at all. Why not use markdown and GitHub?

No collaboration in real-time. Also, markdown requires skill when managing screenshots and diagrams that are not easily accomplished in markdown.

### Why not just use Google Docs?

Would love it if it were possible, but drive does not offer the ability to publish pages cleanly. The URLs are not SEO friendly. Would love it if there was a driveId map where every document could be given a friendly name (aka its title on the drive). Then (like Wikipedia has disambiguation pages), a reader could be redirected to the proper content. Google doesn’t, so this project is an attempt to fill that gap.

Also, Google does not have a good blame system for contributions to a document. Hopefully this is fixed someday but in the meantime, GitHub on markdown can *help* fill the void.

### Why markdown?

All ears for a different preferred format. It’s easy to read when editing directly and when doing a diff for changes it’s clean

### What about mismatches in Docs vs Markdown

There are features of Google Docs that are not going to be supported. Like coloring text, page breaks, headers, comments, etc. These features are not core to our goals for clean WYSIYYM.

Keeping a WYSIWYM style ensures a good mobile experience to view and edit.

### Why not make a website front end to a Google shared drive?

Our goals are to be able to take versions of the content and commit them along with a version of the code at a point in time. By just making a website, it would allow for real-time viewing of the content but no way to go to a specific version of the documentation at a given time.

A website front end is a goal for real-time testing of the viewing experience, but initially, we want to make markdown that can be committed.

## Internals

### .wgd dir structure

#### drive.json:

```
{
  "drive": "https://drive.google.com/drive/folders/FOLDER_ID",
  "drive_id": "",
  "dest": "/home/user/mieweb/wikigdrive-test",
  "flat_folder_structure": false,
  "link_mode": "mdURLs",
  "service_account": "wikigdrive.json"
}
```

#### files.json is indexed with Google's fileId

- id - Google's fileId
- name - Title set inside google docs. It is not unique 
- mimeType - Google's mime type or 'conflict' or 'redirect'
- modifiedTime - Server-size mtime
- desiredLocalPath - slugified name. It is not unique, wikigdrive handles redirects so it is NOT real path in local system
- localPath - real local path, unique with handled conflicts and redirects (in case of title rename)
- lastAuthor - Google's last author if available
- dirty - file needs to be downloaded
- conflictId - unique numeric id for file within files of same desiredLocalPath (used to append localPath)
- conflicting - array of fileIds when mimeType = 'conflict'
- counter - current number of existing conflicts when mimeType = 'conflict'

```
{
    "123123123": {
        "id": "123123123",
        "name": "A title of document",
        "mimeType": "application/vnd.google-apps.document",
        "modifiedTime": "2020-02-27T20:20:20.123Z",
        "desiredLocalPath": "a-title-of-document",
        "lastAuthor": "John Smith",
        "localPath": "a-title-of-document"
    }
}
```

#### binaryFiles.json is indexed with md5 sums: 

- localPath - path to file, generated using md5 sum
- md5Checksum - md5 sum

#### transform.json is indexed with file id

- localPath - path to transformed markdown file
- modifiedTime - fetched from google server

```
{
    "123123123": {
        "localPath": "external_path/123123123.png",
        "md5Checksum": "123123123"
    }
}
```

# Node setup on the system

## using OS
```
curl -sL https://deb.nodesource.com/setup_12.x | sudo bash -
sudo apt install nodejs
```
## If you wish to support multiple versions, add n
```
sudo npm install -g n
sudo n 12.18.3
```
