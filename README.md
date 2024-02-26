# wikiGDrive

test 

Google Drive to MarkDown synchronization

[![Develop Server Deploy](https://github.com/mieweb/wikiGDrive/actions/workflows/DevelopServerDeploy.yml/badge.svg?branch=develop&event=push)](https://github.com/mieweb/wikiGDrive/actions/workflows/DevelopServerDeploy.yml)
[![Prod Server Deploy](https://github.com/mieweb/wikiGDrive/actions/workflows/ProdServerDeploy.yml/badge.svg?branch=master&event=push)](https://github.com/mieweb/wikiGDrive/actions/workflows/ProdServerDeploy.yml)
[![CodeQL](https://github.com/mieweb/wikiGDrive/actions/workflows/codeql-analysis.yml/badge.svg?branch=master&event=push)](https://github.com/mieweb/wikiGDrive/actions/workflows/codeql-analysis.yml?query=event%3Apush+branch%3Amaster+)

WikiGDrive is a node app that uses the [Google Drive API](https://developers.google.com/drive/api/v3/quickstart/nodejs) to transform Google Docs and Drawings into markdown.

With a "Shared Drive" as the key, WikiGDrive:

* Reads all the files from a Google "Shared Drive"
* Builds a map of the driveId (URL) to the pathname in the "Shared Drive"
* For each Google Document:
    * Converts to a Markdown file with the path (instead of the driveId for the file)
    * Changes driveId to the path (eg: 12lvdxKgGsD.../edit would be changed to /filename
    * Support diagrams as SVG (and map the URLs in the diagram)

WikiGDrive scans for changes in the drive and then refresh the local converted files.

## Usage

* [Usage](./website/docs/usage/wikigdrive-usage.md)

## Developer Documentation

* [Developer README](./website/docs/developer-guide.md)
* [Internals](./website/docs/internals.md)
  
