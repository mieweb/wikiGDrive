# Confluence to Google Docs Conversion Notes

## Goal

Convert Confluence Documents in to Google Documents for the purpose of using WikiGDrive to publish them.

## Delivery

A new github repo with a node.js script specific to this conversion.

## High level Process

* Scan all of the documents in a Confluence Space
* Make google documents in a shared drive (two passes will be required so links between documents can be known as content is added).
    * Parent/Child relationship must be intact.
* Import Confluence "Attachments" to Google Drive so they can be referenced.
* For each document
    * Import content from Confluence Page into Google Documents
    * Heading should be headings
    * Paragraphs should be paragraphs
    * Images (which are attachments in Confluence) should be embedded in google docs <a id="cukuroni2k4r"></a>
    * Macros can be wrapped in {{% curlies %}} and dumped as text
        * <strong>Example Block Macro:</strong>
          {{% macroname propertyname='value' propertyname='value' %}}
          macro body, if exists
          {{% /macroname %}}
        * <strong>Example Inline Macro:</strong>
          {{% macroname propertyname='value' propertyname='value' /%}}
    * Tables should be kept tables
    * Embedded Video should be converted to an image with a hyperlink
    * Formatting is not required to be converted.

## Proposed Instructions

```
confluence2google <path to space> <path to google shared drive>
```

## Links and Possible Approaches

1. Use REST API
    1. [Confluence Cloud REST API](https://developer.atlassian.com/cloud/confluence/rest/)
    2. [Confluence Server REST API](https://docs.atlassian.com/ConfluenceServer/rest/7.0.3/)
    3. [https://confluence.example.com/rest/api/space/DOCS10/content](https://confluence.example.com/rest/api/space/DOCS10/content)
    4. Tiny Example Space: [https://confluence.example.com/rest/api/space/TES/content](https://confluence.example.com/rest/api/space/TES/content)
2. Use export file
    1. [Confluence Export](https://confluence.atlassian.com/confcloud/import-a-confluence-space-724765531.html) makes a zipped file with [XML Format](https://confluence.atlassian.com/jirakb/xml-format-for-import-export-files-695108230.html)
    2. [Example HTML zip file](gdoc:abc)
    3. [Example XML zip file](gdoc:abc)
3. Use HTML
    1. [Confluence Export](https://confluence.atlassian.com/confcloud/import-a-confluence-space-724765531.html) that makes an HTML file

<a id="ggsym7lvzx37"></a>

## Examples

Simple - [https://confluence.example.com/display/DOCS/Sample](https://confluence.example.com/display/DOCS/Sample)

	API Call: [https://confluence.example.com/rest/api/content/789](https://confluence.example.com/rest/api/content/789)

Complex - [https://confluence.example.com/pages/viewpage.action?pageId=789](https://confluence.example.com/pages/viewpage.action?pageId=789)

	API Call: [https://confluence.example.com/rest/api/content/789](https://confluence.example.com/rest/api/content/789)
