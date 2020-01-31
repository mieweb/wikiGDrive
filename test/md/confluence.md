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

    * Macros can be wrapped in {{% curlies %}} and dumped as text

        * <strong><em>Example Block Macro:</em></strong>  {{% macroname propertyname='value' propertyname='value' %}}macro body, if exists{{% /macroname %}}

        * <strong>Example Inline Macro:</strong>{{% macroname propertyname='value' propertyname='value' /%}}

    * Tables should be kept tables

    * Embedded Video should be converted to an image with a hyperlink

    * Formatting is not required to be converted.



## Proposed Instructions



```
confluence2google <path to space> <path to google shared drive>
```


## Links and Possible Approaches

1. Use REST API
    1. [Confluence Cloud REST API](test.md)
    2. [Confluence Server REST API](test.md)
    3. [https://confluence.example.com/rest/api/space/DOCS/content](test.md)
    4. Tiny Example Space: [https://confluence.example.com/rest/api/space/TEST/content](test.md) 
2. Use export file
    5. [Confluence Export](test.md) makes a zipped file with [XML Format](test.md)
    6. [Example HTML zip file](test.md) 
    7. [Example XML zip file](test.md)
3. Use HTML
    8. [Confluence Export](test.md) that makes an HTML file

## Examples

Simple - [https://confluence.example.com/display/DOCS/Sample](test.md)

	API Call: [https://confluence.example.com/rest/api/content/123](test.md)

Complex - [https://confluence.example.com/pages/viewpage.action?pageId=789](test.md)

	API Call: [https://confluence.example.com/rest/api/content/456](test.md)



