# Wiki G Drive Project Overview



* [Wiki G Drive Project Overview](#wiki-g-drive-project-overview)
* [Overview](#overview)
* [Links](#links)
* [Contacts](#contacts)
* [Requirements](#requirements)
* [Instructions (proposed)](#instructions-(proposed))
* [Renames and Redirecting](#renames-and-redirecting)
* [Collisions with Filenames](#collisions-with-filenames)
* [Table of Contents and Index](#table-of-contents-and-index)
* [Table of Contents](#table-of-contents)
* [Index](#index)
* [FAQ](#faq)



## Overview

Develop a node.js script that will use the Google Drive API  ([https://developers.google.com/drive/api/v3/quickstart/nodejs](test.md)) 



With a "Shared Drive" as the key:

* Read all the files from a Google "Shared Drive"

* Build a map of the driveId (URL) to the pathname in the "Shared Drive"

* For each Google Document:

    * Convert to a Markdown file with the path (instead of the driveId for the file)

    * Change driveId to the path  (eg:  12lvdxKgGsD.../edit would be changed to /filename

    * Support diagrams as SVG (and map the URLs in the diagram)



The script should scan for changes in the drive and then refresh the local converted files.



![](test.md)



The node.js script should refresh the "Local Filesystem" with changes from the Google Shared Drive overwriting or deleting any content to bring it into sync.  The Local Filesystem is not preserved (since we will be committing the markdown in github anyway).



## Links

* Project [https://github.com/mieweb/wikiGDrive](test.md) 

* Google [Shared Drive Example](test.md)

* Upwork [posting](test.md) 

* Example system: [http://wikigrive.gitgis.com/toc.html](test.md) 



## Contacts

* Doug Horner ([example@example.com](test.md)) phone: 123-123-123



## Requirements



The app must:

1. be able to be run once or run as a daemon (looking for changes in near real-time)

2. Take changes from gdrive and propagate them down to the local file system (likely a git repo)

3. Detect file [moves and renames](#renames-and-redirecting) from prior runs and leave redirects in the local file system to the new file or directory. 

4. Convert google docs to markdown while preserving as much of the meaning of the document. (Headings, images, drawings, tables, etc). 

    A. Each generated file should have parsable comments embedded in the original source google doc is known. 

    B. Embedded images (not originally stored on the shared folder will have to be extracted to the filesystem with a hashing system to prevent duplicate copies files in cases where images are pasted into multiple documents.

5. Convert google drawings to svg and fix up urls as well. 

6. Download images and place them in the proper folder. Embed metadata in the image pointing to the source on the google drive. It could be a .md file with the same name as the image. 

7. Translate hyperlinks to the filesystem relative paths if they exist in the shared drive (both within Docs and Drawings). Must support both document urls and heading URLs. 

8. Construct a [table of contents and an index](#table-of-contents-and-index) from all of the documents in the shared drive.

    C. It should be parsable so Javascript on the client could search and build navigation 

    D. There should be generated markdown file ([toc.md](#table-of-contents) and [index.md](#index))





Later phase:

* Confluence -> markdown export

* Scientific notation for headers (as an option)

* Google sheets to CSV with MIE’s datavis

* Markdown -> Google Docs converter





## Instructions (proposed)



npm install wikigdrive



node_modules/bin/wikigdrive -h



wikigdrive [shared drive url]



Options:

—config (.wikigdrive)

—user

—pass

—dest (current working folder)

—watch (keep scanning for changes, ie: daemon)



wikigdrive keeps a local JSON config file in the dest directory with state from prior runs. The config contains a map of URL driveIds to the local filenames along with metadata about each file. 



## Renames and Redirecting 

When a Document is renamed or moved in the shared drive the driveId says the same, but its place in the filesystem changes. For example a document named "Carbon" would be created as Carbon.md. Sometime later its renamed to “Carbon Fiber” then a new file “Carbon Fiber.md” would be made with the content and the old “Carbon.md” is changed to:



```
Renamed to [Carbon Fiber](Carbon-Fiber.md)
```


By leaving the old markdown files no one gets lost or gets broken links if the names change. 



If a document is moved from one folder to another or a directory is renamed, all files in the path will get renamed too and the original paths will get a redirect file in their old location.  For example



* Folder

    * Example-1.md

    * Example-2.md



If Folder is renamed to Container, the new layout would be:

* Container

    * Example-1.md

    * Example-2.md

* Folder

    * Example-1.md -> /Container/Example-1.md

    * Example-2.md -> /Container/Example-2.md



Then sometime later, "Example 1" is renamed to “Sample 1” the folder layout should be:

* Container

    * <strong>Sample</strong>-1.md

    * Example-1.md -> <strong>Sample</strong>-1.md

    * Example-2.md

* Folder

    * Example-1.md -> /Container/<strong>Sample</strong>-1.md

    * Example-2.md -> /Container/Example-2.md





## Collisions with Filenames

Google Drive allows filenames with the same name to be created on shared drives.  When transforming them into the local filesystem, each file will be renamed to a new file and a disambiguation page will be placed in their place.  Eg:



Google Drive              Folder

  Carbon                    Carbon-1.md		

  Carbon                    Carbon-2.md

                            Carbon.md 



The contents of Carbon.md would show each of the conflicting references:



    There were two documents with the same name in the same folder.

    * [Carbon](Carbon-1.md) 

    * [Carbon](Carbon-2.md) 

 

## Table of Contents and Index

In the root of the local filesystem two files will be created: the toc.md and index.md

### Table of Contents

The table of contents is a layout of the documents and their position in the drive as an unordered list. It should not contain redirected files, images, etc. 

### Index

The index is a listing of all of the defined terms and their references in the documents.  The processing may be passed to another tool to construct the index. Examples: [kramdown](test.md), [Asciidoctor](test.md)

## FAQ

* What is the purpose of this tool?

    * To enable collaborative editing of documentation and the ability to publish that documentation as well as linking it to revision control system branches (like in git)

* Why use google at all. Why not use markdown and GitHub?

    * No collaboration in real-time. Also, markdown requires skill when managing screenshots and diagrams that are not easily accomplished in markdown. 

* Why not just use google docs?

    * Would love it if it were possible, but the drive does not offer the ability to publish pages in a clean way. The URLs are not SEO friendly. Would love it if there was a driveId map where every document could be given a friendly name (aka its title on the drive). Then (like Wikipedia has [disambiguation](test.md) pages), a reader could be redirected to the proper content. Google doesn’t, so this project is an attempt to fill that gap. 

    * Also, Google does not have a good blame system for contributions to a document. Hopefully, this is fixed someday but in the meantime, GitHub on markdown can *help* fill the void. 

* Why markdown?

    * All ears for a different preferred format. It’s easy to read when editing directly and when doing a diff for changes it’s clean

* What about mismatches in Docs vs Markdown

    * There are features of Google Docs that are not going to be supported. Like coloring text, page breaks, headers, comments, etc. These features are not core to our goals for clean [WYSIYYM](test.md). 

    * Keeping a WYSIWYM style insures a good mobile experience to view and edit. 

* Why not make a website front end to a Google shared drive?

    * Our goals are to be able to take versions of the content and commit them along with a version of the code at a point in time. By just making a website, it would allow for real time viewing of the content but no way to go to a specific version of the documentation at a given time.

    * A website front end is a goal for real-time testing of the viewing experience but initially, we want to make markdown that can be committed. 

