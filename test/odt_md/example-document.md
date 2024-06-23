* [Heading 1](#heading-1)
* [Heading level 2](#heading-level-2)
* [Heading level 3 - with a table](#heading-level-3-with-a-table)
* [Heading 3 - a diagram with links](#heading-3-a-diagram-with-links)
* [Heading 3 - with a Table of contents](#heading-3-with-a-table-of-contents)
* [Other examples](#other-examples)
* [Image](#image)
* [Preformatted Text](#preformatted-text)

# Heading 1 <a id="_pur85qa8iw5l"></a>

## Heading level 2 <a id="_rwkjzl1scjzh"></a>

Some normal text with hyperlinks to a [website](https://www.enterprisehealth.com/) and a link to a document on the [shared drive](gdoc:1H6vwfQXIexdg4ldfaoPUjhOZPnSkNn6h29WD6Fi-SBY) with multiple versions of [the link](gdoc:1H6vwfQXIexdg4ldfaoPUjhOZPnSkNn6h29WD6Fi-SBY) because people cut and paste. [Link to test page](gdoc:1iou0QW09pdUhaNtS1RfjJh12lxKAbbq91-SHGihXu_4). Link to [doc in another folder](gdoc:1G4xwfBdH5mvEQyGN16TD2vFUHP8aNgU7wPst-2QTZug).

### Heading level 3 - with a table <a id="_t3tjnjbci85"></a>

<table>
<tr>
<td>Heading 1</td>
<td>Heading 2</td>
<td>Heading 3</td>
<td>Heading 4</td>
<td>Heading 5</td>
</tr>
<tr>
<td>Cell 1</td>
<td>Cell 2</td>
<td>Cell 3</td>
<td>Cell 4<br />
<table>
<tr>
<td>C1</td>
<td><strong>C2</strong></td>
</tr>
<tr>
<td>C3</td>
<td>C4</td>
</tr>
</table>
After subtable</td>
<td>Cell 5</td>
</tr>
</table>

### Heading 3 - a diagram with links <a id="_ambls07qke35"></a>

[Diagram](gdoc:1Du-DYDST4liLykJl0fHSCvuQYIYhtOfwco-ntn38Dy8)

[Diagram](gdoc:1Du-DYDST4liLykJl0fHSCvuQYIYhtOfwco-ntn38Dy8)

### Heading 3 - with a Table of contents <a id="_f49uy1gok3t5"></a>

* [Heading 1](#heading-1)
* [Heading level 2](#heading-level-2)
* [Heading level 3 - with a table](#heading-level-3-with-a-table)
* [Heading 3 - a diagram with links](#heading-3-a-diagram-with-links)
* [Heading 3 - with a Table of contents](#heading-3-with-a-table-of-contents)
* [Other examples](#other-examples)
* [Image](#image)
* [Preformatted Text](#preformatted-text)

# Other examples <a id="_p5x030kzej77"></a>

## Image <a id="_p56cvcv8bx70"></a>

![](1000000000000640000001CF60FB0243CA95EC14.jpg)

![](10000000000003F0000003F092F85671239C65F9.jpg)

## Preformatted Text <a id="_74or9yzabmh6"></a>

```
This is monospaced text. This should line up  |
                                    with this |

```

## Code <a id="_niow4ogfp967"></a>

Code blocks are part of the Markdown spec, but syntax highlighting isn't. However, many renderers -- like Github's and *Markdown Here* -- support syntax highlighting. Which languages are supported and how those language names should be written will vary from renderer to renderer. *Markdown Here* supports highlighting for dozens of languages (and not-really-languages, like diffs and HTTP headers); to see the complete list, and how to write the language names, see the [highlight.js demo page](http://softwaremaniacs.org/media/soft/highlight/test.html).

### Typescript / Javascript <a id="_jt47qp4o5ir1"></a>

{{markdown}}
```javascript

class MyClass {
  public static myValue: string;
  constructor(init: string) {
    this.myValue = init;
  }
}
import fs = require("fs");
module MyModule {
  export interface MyInterface extends Other {
    myProperty: any;
  }
}
declare magicNumber number;
myArray.forEach(() => { }); // fat arrow syntax
```
{{/markdown}}

## Video <a id="_9b72fldy8rju"></a>

From Youtube:

[Google Drive, Docs, and Project Management with GSuite](https://www.youtube.com/watch?v=v6QAIWLCz8I&t=1743s)

## Horizontal Lines <a id="_q7zgn9e3oi6b"></a>

This is some text separated by a horizontal line

___

This is after the horizontal line.

## Lists <a id="_y08cxsphsa2c"></a>

* Bullet 1
* Bullet 2
    * SubBullet 1
    * SubBullet 2
* Bullet 3
    1. SubNumeric 1
    2. SubNumeric 2
    3. SubNumeric 3
1. Alpha 1
2. Alpha 2
3. Alpha 3

## Formatting <a id="_fjarmlobo4r"></a>

Some **bold** **_boldanditalic_*** italic*  text

## Equations <a id="_guzoh1oxt0s4"></a>

### Using the actual equation object <a id="_xupy2b5teiu"></a>

```math
E = m c^{2}
```

```math
e^{i \pi} - 1 = 0
```

### Text equivalent <a id="_decz1axq5tzn"></a>

*E=mc**2*

Inline $$E = m c^{2}$$ math

## Footnotes <a id="_44175oezvk2"></a>

1Footnotes should display as a footnote, and should always display at the very end of the document (page)**?** This is some sample text with a footnote.

This is some other data.
