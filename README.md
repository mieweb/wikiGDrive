# wikiGDrive

Google Drive to MarkDown synchronization

[![CircleCI](https://circleci.com/gh/mieweb/wikiGDrive.svg?style=svg)](https://circleci.com/gh/mieweb/wikiGDrive)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/mieweb/wikiGDrive.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/mieweb/wikiGDrive/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/mieweb/wikiGDrive.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/mieweb/wikiGDrive/context:javascript)
[![Project Dependencies](https://david-dm.org/mieweb/wikiGDrive.svg)](https://david-dm.org/mieweb/wikiGDrive)
[![devDependencies Status](https://david-dm.org/mieweb/wikiGDrive/dev-status.svg)](https://david-dm.org/mieweb/wikiGDrive?type=dev)


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
5. Put credentials into .env or run wikigdrive with --client_id CLIENT_ID --client_secret SECRET

## Usage and options

```
wikigdrive https://drive.google.com/drive/u/0/folders/FODERID

--config /location/of/.wikigdrive - Location of config file
--dest /location/of/downloaded/content - Destination for downloaded and converted markdown files
--watch - Run program in loop, watch for gdrive changes

--drive_id - An ID of the drive

--client_id - ID of google app, alternatively can be passed in .env or through environment variable CLIENT_ID;
--client_secret - Secret of google app, alternatively can be passed in .env or through environment variable CLIENT_SECRET;

--link_mode - Style of internal markdown links
--link_mode mdURLs - `/filename.md`
--link_mode dirURLs - `/filename/`
--link_mode uglyURLs - `/filename.html` - see https://gohugo.io/getting-started/configuration/

--config-reset [sectionName] - Reset sections of .wikigdrive section. It cleans them at the app start
--config-reset google_auth - Reset `google_auth` section
--config-reset google_auth,fileMap,binaryFiles - Reset `google_auth,fileMap,binaryFiles` sections
--config-reset-all - Reset all sections

--without-folder-structure    Download documents into single, flat folder
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
wikigdrive https://drive.google.com.pathtothefolder --dest ./content
```

6. Generate HTML

```
hugo
```

## Authorization

There are two methods: individual credentials or a service account.

- [Individual](https://cloud.google.com/docs/authentication/end-user#creating_your_client_credentials)
- [Service Account](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority)

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

### .wikigdrive structure

```
{
    "binaryFiles": {
        "123123123": {
            "localPath": "external_path/123123123.png",
            "md5Checksum": "123123123"
        }
    },
    "fileMap": {
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
}
```

#### binaryFiles map is indexed with md5 sums

- localPath - path to file, generated using md5 sum
- md5Checksum - md5 sum

#### fileMap is indexed with Google's fileId

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
