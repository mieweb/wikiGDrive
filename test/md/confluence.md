# Confluence to Google Docs Conversion Notes

## Goal

Convert Confluence Documents in to Google Documents for the purpose of using WikiGDrive to publish them.



## Delivery

A new github repo with a node.js script specific to this conversion.

## High level Process

* Scan all of the documents in a Confluence Space

* Make google documents in a shared drive (two passes will be required so links between documents can be known as content is added.

* Import Confluence "Attachments" to Google Drive so they can be referenced.

* For each document

    * Import content from Confluence Page into Google Documents

    * Heading should be headings

    * Paragraphs should be paragraphs

    * Images (which are attachments in Confluence) should be embedded in google docs

    * Macros can be wrapped in {curlies} and dumped as text**
**
        * **Example Block Macro:**  {macroname propertyname=’value’ propertyname=’value’}macro body, if exists{/macroname}

        * **Example Inline Macro:**{macroname propertyname=’value’ propertyname=’value’ /}

    * Tables should be kept tables

    * Embedded Video should be converted to an image with a hyperlink

    * Formatting is not required to be converted.



## Proposed Instructions



```
confluence2google <path to space> <path to google shared drive>
```


## Links and Possible Approaches

1. Use REST API

    A. [Confluence Cloud REST API](test.md)

    B. [Confluence Server REST API](test.md)

    C. [https://confluence.example.com/rest/api/space/DOCS/content](test.md)

    D. Tiny Example Space: [https://confluence.example.com/rest/api/space/TEST/content](test.md) 

2. Use export file

    E. [Confluence Export](test.md) makes a zipped file with [XML Format](test.md)

    F. [Example HTML zip file](test.md) 

    G. [Example XML zip file](test.md)

3. Use HTML

    H. [Confluence Export](test.md) that makes an HTML file



## Examples

Simple - [https://confluence.example.com/display/DOCS/Sample](test.md)

	API Call: [https://confluence.example.com/rest/api/content/123](test.md)

Complex - [https://confluence.example.com/pages/viewpage.action?pageId=789](test.md)

	API Call: [https://confluence.example.com/rest/api/content/456](test.md)



