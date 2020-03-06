# wikiGDrive

Google Drive to MarkDown synchronization

[![CircleCI](https://circleci.com/gh/mieweb/wikiGDrive.svg?style=svg)](https://circleci.com/gh/mieweb/wikiGDrive)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/mieweb/wikiGDrive.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/mieweb/wikiGDrive/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/mieweb/wikiGDrive.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/mieweb/wikiGDrive/context:javascript)
[![Project Dependencies](https://david-dm.org/mieweb/wikiGDrive.svg)](https://david-dm.org/mieweb/wikiGDrive)
[![devDependencies Status](https://david-dm.org/mieweb/wikiGDrive/dev-status.svg)](https://david-dm.org/mieweb/wikiGDrive?type=dev)

## Install - TODO: put into npm

npm install -g wikigdrive

## App setup

1. Go to console https://console.developers.google.com/
2. Create New Project 
2. Enable Apis -> add Google Drive API
3. Enable Apis -> Add Google Docs API
4. Credentials ->  Create Credentials (OAuth Client ID) -> Other
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

4. Install wikigdrive - TODO: use npm install 

```
npm link wikigdrive .....pathtowikigdrive
```

5. Sync GDrive

wikigdrive https://drive.google.com.pathtothefolder --dest ./content

6. Generate HTML

```
hugo
```

## FAQ

### What is the purpose of this tool?

To enable collaborative editing of documentation and the ability to publish that documentation as well as linking it to revision control system branches (like in git)

### Why use google at all. Why not use markdown and github?

No collaboration in real time. Also markdown requires a skill when managing screenshots and diagrams that are not easily accomplished in markdown. 

### Why not just use google docs?

Would love it if it were possible, but drive does not offer the ability to publish pages in a clean way. The urls are not SEO friendly. Would love it if there was a driveId map where every document could be given a friendly name (aka its title on the drive). Then (like Wikipedia has disambugation pages), a reader could be redirected to the proper content. Google doesn’t, so this project is an attempt to fill that gap. 

Also google does not have a good blame system for contributions to a document. Hopefully this is fixed someday but in the meantime GitHub on markdown can *help* fill the void. 

### Why markdown?

All ears for a different preferred format. It’s easy to read when editing directly and when doing a diff for changes it’s clean

### What about mismatches in Docs vs Markdown

There are features of google Docs that are not going to be supported. Like coloring text, page breaks, headers, comments, etc. These features are not core to our goals for clean WYSIYYM. 

Keeping a WYSIWYM style insures a good mobile experience to view and edit. 

### Why not make a website front end to a Google shared drive?

Our goals are to be able to take versions of the content and commit them along with a version of the code at a point in time. By just making a website, it would allow for real time viewing of the content but no way to go to a specific version of the documentation at a given time.

A website front end is a goal for real-time testing of the viewing experience but initially we want to make markdown that can be committed. 
