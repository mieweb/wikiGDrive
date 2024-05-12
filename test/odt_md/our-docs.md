# wikiGDrive

Google Drive to MarkDown synchronization

[![Develop Server Deploy](https://github.com/mieweb/wikiGDrive/actions/workflows/DevelopServerDeploy.yml/badge.svg?branch=develop&event=push)](https://github.com/mieweb/wikiGDrive/actions/workflows/DevelopServerDeploy.yml) [![Prod Server Deploy](https://github.com/mieweb/wikiGDrive/actions/workflows/ProdServerDeploy.yml/badge.svg?branch=master&event=push)](https://github.com/mieweb/wikiGDrive/actions/workflows/ProdServerDeploy.yml) [![CodeQL](https://github.com/mieweb/wikiGDrive/actions/workflows/codeql-analysis.yml/badge.svg?branch=master&event=push)](https://github.com/mieweb/wikiGDrive/actions/workflows/codeql-analysis.yml?query=event%3Apush+branch%3Amaster+)

WikiGDrive is a node app that uses the [Google Drive API](https://developers.google.com/drive/api/v3/quickstart/nodejs) to transform Google Docs and Drawings into markdown.

![Diagram](https://drive.google.com/open?id=1TjB_v1gcBy23MtBQKvh5FZ3fFUp520QZ)

[Google Drive Notes](gdoc:1H6vwfQXIexdg4ldfaoPUjhOZPnSkNn6h29WD6Fi-SBY) | [Github Project](https://github.com/mieweb/wikiGDrive/projects) | [Github Developer Notes](gdoc:1NJUxTnJHgkMO3JV1v_DFPsVsl8nDhweyDvNW0y98TGs)

With a "Shared Drive" as the key, WikiGDrive:

* Reads all the files from a Google "Shared Drive"
* Builds a map of the driveId (URL) to the pathname in the "Shared Drive"
* For each Google Document:
    * Converts to a Markdown file with the path (instead of the driveId for the file)
    * Changes driveId to the path (eg: 12lvdxKgGsD.../edit would be changed to /filename
    * Support diagrams as SVG (and map the URLs in the diagram)

WikiGDrive scans for changes in the drive and then refresh the local converted files.

## Developer Documentation

* [Developer README](gdoc:1NJUxTnJHgkMO3JV1v_DFPsVsl8nDhweyDvNW0y98TGs)
* [Internals](gdoc:1ug9ASkGlkwJHyYRoFB4OY3GJCDFqQikz2UN0HTQFs88)

## Install from NPM

*Not currently working*

See [https://github.com/mieweb/wikiGDrive/issues/297](https://github.com/mieweb/wikiGDrive/issues/297) for status.

[![View this project on NPM](https://img.shields.io/npm/v/@mieweb/wikigdrive.svg)](https://www.npmjs.com/package/@mieweb/wikigdrive) [![NPM downloads](https://img.shields.io/npm/dm/@mieweb/wikigdrive.svg)](https://www.npmjs.com/package/@mieweb/wikigdrive) ![Publish wikigdrive to NPM](https://github.com/mieweb/wikiGDrive/workflows/Publish%20wikigdrive%20to%20NPM/badge.svg)
```
npm i -g @mieweb/wikigdrive
```

## App setup

1. Go to [console](https://console.developers.google.com/)
2. Create New Project
3. Enable Apis -> add Google Drive API
4. Enable Apis -> Add Google Docs API
5. Credentials -> Create Credentials (OAuth Client ID) -> Other ( see authorization section )

## Usage and options

Init workdir with (creates internal .wgd directory):

```
wikigdrive init --drive "https://drive.google.com/drive/folders/FOLDER_ID"

--service_account=wikigdrive.json
--config /location/of/.wgd - Location of config file
--dest /location/of/downloaded/content - Destination for downloaded and converted markdown files

--client_id - ID of google app, alternatively can be passed in .env or through environment variable CLIENT_ID;
--client_secret - Secret of google app, alternatively can be passed in .env or through environment variable CLIENT_SECRET;

--link_mode - Style of internal markdown links
--link_mode mdURLs - `/filename.md`
--link_mode dirURLs - `/filename/`
--link_mode uglyURLs - `/filename.html` - see https://gohugo.io/getting-started/configuration/
```

List available drive ids that wikigdrive has access to on Google:

```
wikigdrive drives
```

Run one time documents pull

```
wikigdrive pull
```

Run server mode

```
wikigdrive server
```

## Example usage with Hugo Generator

1. Install [hugo](https://gohugo.io/getting-started/quick-start/)
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

Note that by default you need to use [uglyURLs](https://gohugo.io/content-management/urls/#ugly-urls) with Hugo.

6. Generate HTML
```
hugo
```

or start server for development:

```
hugo server
```

## Example usage with Hexo Generator

1. Install [hexo](https://hexo.io/docs/main.html)
```
npm i -g hexo-cli
```

2. Create a New Site
```
hexo init quickstart
```

3. Add a Theme

By default, hexo installs landscape theme. If you need another one check [hexo themes](https://hexo.io/docs/themes)

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

* [Individual](https://cloud.google.com/docs/authentication/end-user#creating_your_client_credentials)
* [Service Account](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority)

Note: If the authentication is successful, but the account does not have access to documents in gdrive, there is currently no way to know if the directory is empty or just not possible to see.
