import {
  DocumentContent, DocumentStyles, DrawCustomShape, DrawEnhancedGeometry,
  DrawFrame, DrawG,
  DrawRect, GraphicProperty, ListStyle,
  OfficeText,
  ParagraphProperty,
  Style,
  TableCell,
  TableOfContent,
  TableRow,
  TableTable,
  TextLink,
  TextList,
  TextParagraph,
  TextProperty,
  TextSpace,
  TextSpan
} from './LibreOffice.ts';
import {urlToFolderId} from '../utils/idParsers.ts';
import {MarkdownChunks} from './MarkdownChunks.ts';
import {isMarkdownMacro, StateMachine} from './StateMachine.ts';
import {inchesToPixels, inchesToSpaces, spaces} from './utils.ts';
import {extractPath} from './extractPath.ts';
import {mergeDeep} from './mergeDeep.ts';
import {RewriteRule} from './applyRewriteRule.ts';
import {postProcessText} from './postprocess/postProcessText.ts';

function getBaseFileName(fileName) {
  return fileName.replace(/.*\//, '');
}

const COURIER_FONTS = ['Courier New', 'Courier'];

interface FileNameMap {
  [name: string]: string
}

function getInnerText(span: TextSpan) {
  let retVal = '';
  for (const child of span.list) {
    if (typeof child === 'string') {
      retVal += child;
      continue;
    }
    switch (child.type) {
      case 'line_break':
        retVal += '\n';
        break;
      case 'tab':
        retVal += '\t';
        break;
      case 'space':
        retVal += spaces((<TextSpace>child).chars || 1);
        break;
    }
  }
  return retVal;
}

export class OdtToMarkdown {

  private readonly stateMachine: StateMachine;
  private readonly styles: { [p: string]: Style } = {};
  public readonly links: Set<string> = new Set<string>();
  private readonly chunks: MarkdownChunks = new MarkdownChunks();
  private picturesDir = '';
  private rewriteRules: RewriteRule[] = [];

  constructor(private document: DocumentContent, private documentStyles: DocumentStyles, private fileNameMap: FileNameMap = {}) {
    this.stateMachine = new StateMachine(this.chunks);
  }

  getStyle(styleName: string): Style {
    if (!this.styles[styleName]) {
      const docStyle = this.documentStyles?.styles?.styles.find(a => a.name === styleName);
      if (docStyle) {
        return structuredClone(docStyle);
      }

      return {
        name: 'default',
        listStyleName: '',
        parentStyleName: '',
        paragraphProperties: new ParagraphProperty(),
        textProperties: new TextProperty(),
        graphicProperties: new GraphicProperty()
      };
    }

    const parentStyle = this.getStyle(this.styles[styleName].parentStyleName);
    return structuredClone(mergeDeep(parentStyle, this.styles[styleName]));
  }

  getListStyle(listStyleName): ListStyle {
    if (!this.documentStyles?.styles?.listStyles) {
      return null;
    }

    return this.documentStyles.styles.listStyles.find(ls => ls.name === listStyleName) || null;
  }

  async convert(): Promise<string> {
    const listLevelsObj = {};
    const listMargins = {};

    if (this.document.automaticStyles) {
      for (const namedStyle of this.document.automaticStyles.styles) {
        this.styles[namedStyle.name] = namedStyle;
      }

      for (const namedStyle of this.document.automaticStyles.styles) {
        if (namedStyle.listStyleName) {
          listLevelsObj[namedStyle.paragraphProperties?.marginLeft] = true;
          listMargins[namedStyle.listStyleName] = namedStyle.paragraphProperties?.marginLeft;
        }
      }
    }

    const listLevels = Object.keys(listLevelsObj);
    listLevels.sort((a, b) => inchesToPixels(a) - inchesToPixels(b));

    this.stateMachine.setListLevels(listLevels);

    for (const tableOfContent of this.document.body.text.list) {
      if (tableOfContent.type === 'toc') {
        await this.tocToText(<TableOfContent>tableOfContent);
      }
    }
    await this.officeTextToText(this.document.body.text);

    // text = this.processMacros(text);
    // text = this.fixBlockMacros(text);

    this.stateMachine.postProcess();

    const markdown = this.chunks.toString(this.rewriteRules);
    const trimmed = this.trimBreaks(markdown);
    const rewrittenHeaders = await this.rewriteHeaders(trimmed);
    return postProcessText(rewrittenHeaders);
  }

  trimBreaks(markdown: string) {
    const rows = markdown.split('\n');

    let inSidePre = false;
    for (let i = 0; i < rows.length - 1; i++) {
      if (rows[i].substring(0, 3) === '```') {
        inSidePre = !inSidePre;
      }

      if (inSidePre && (rows[i].match(/[^ ] {2}$/))) {
        rows[i] = rows[i].replace(/ {2}$/, '');
        continue;
      }

      if ((rows[i].match(/[^ ] {2}$/)) && rows[i + 1].trim().length === 0) {
        rows[i] = rows[i].replace(/ {2}$/, '');
        continue;
      }

      if (rows[i] === '  ') {
        rows[i] = '';
        continue;
      }
    }

    return rows.join('\n');
  }

  getErrors() {
    return this.stateMachine.errors;
  }

  async tocToText(tableOfContent: TableOfContent): Promise<void> {
    this.stateMachine.pushTag('TOC');
    for (const paragraph of tableOfContent.indexBody.list) {
      await this.paragraphToText(paragraph);
    }
    this.stateMachine.pushTag('/TOC');
  }

  async spanToText(span: TextSpan): Promise<void> {
    const style = this.getStyle(span.styleName);

    if (COURIER_FONTS.indexOf(style.textProperties.fontName) > -1) {
      this.stateMachine.pushTag('CODE');
    }


    if (style.textProperties?.fontStyle === 'italic' && style.textProperties?.fontWeight === 'bold') {
      this.stateMachine.pushTag('BI');
    } else
    if (style.textProperties?.fontStyle === 'italic') {
      this.stateMachine.pushTag('I');
    } else
    if (style.textProperties?.fontWeight === 'bold') {
      this.stateMachine.pushTag('B');
    }

    for (const child of span.list) {
      if (typeof child === 'string') {
        this.stateMachine.pushText(child);
        continue;
      }
      switch (child.type) {
        case 'line_break':
          this.stateMachine.pushTag('BR/');
          break;
        case 'tab':
          this.stateMachine.pushText('\t');
          break;
        case 'space':
          this.stateMachine.pushText(spaces((<TextSpace>child).chars || 1));
          break;
      }
    }

    if (style.textProperties?.fontStyle === 'italic' && style.textProperties?.fontWeight === 'bold') {
      this.stateMachine.pushTag('/BI');
    } else
    if (style.textProperties?.fontStyle === 'italic') {
      this.stateMachine.pushTag('/I');
    } else
    if (style.textProperties?.fontWeight === 'bold') {
      this.stateMachine.pushTag('/B');
    }

    if (COURIER_FONTS.indexOf(style.textProperties.fontName) > -1) {
      this.stateMachine.pushTag('/CODE');
    }
  }

  addLink(href: string) {
    if (href && !href.startsWith('#') && href.indexOf(':') > -1) {
      this.links.add(href);
    }
  }

  async linkToText(link: TextLink): Promise<void> {
    let href = link.href;
    const id = urlToFolderId(href);
    if (id) {
      href = 'gdoc:' + id;
    }

    this.addLink(href);

    this.stateMachine.pushTag('A', { href: href });

    for (const child of link.list) {
      if (typeof child === 'string') {
        this.stateMachine.pushText(child);
        continue;
      }
      switch (child.type) {
        case 'span':
          {
            await this.spanToText(<TextSpan>child);
          }
          break;
      }
    }

    this.stateMachine.pushTag('/A', { href: href });
  }

  async drawCustomShape(drawCustomShape: DrawCustomShape) {
    // https://documentation.libreoffice.org/assets/Uploads/Documentation/en/Tutorials/CustomShapes7/Custom-Shape-Tutorial.odt
    // https://code.woboq.org/libreoffice/libreoffice/svx/source/customshapes/EnhancedCustomShape2d.cxx.html#1808
    // https://code.woboq.org/libreoffice/libreoffice/xmloff/source/draw/ximpcustomshape.cxx.html
    const style = this.getStyle(drawCustomShape.styleName);

    const logwidth = inchesToPixels(drawCustomShape.width);
    const logheight = inchesToPixels(drawCustomShape.height);

    this.stateMachine.pushTag('EMB_SVG', {
      width: logwidth,
      height: logheight
    });

    for (const item of drawCustomShape.list) {
      if (item.type === 'draw_enhanced_geometry') {
        const enhancedGeometry = <DrawEnhancedGeometry>item;

        this.stateMachine.pushTag('EMB_SVG_P/', {
          pathD: extractPath(enhancedGeometry, logwidth, logheight),
          style
        });
      }
    }
    for (const item of drawCustomShape.list) {
      if (item.type === 'paragraph') {
        const paragraph = <TextParagraph>item;

        if (paragraph.list.length === 0) {
          continue;
        }

        this.stateMachine.pushTag('EMB_SVG_TEXT');
        for (const child of paragraph.list) {
          if (typeof child === 'string') {
            this.stateMachine.pushText(child);
            continue;
          }
          switch (child.type) {
            case 'span':
            {
              const span = <TextSpan>child;

              const style = this.getStyle(span.styleName);
              this.stateMachine.pushTag('EMB_SVG_TSPAN', {
                style
              });

              for (const child of span.list) {
                if (typeof child === 'string') {
                  this.stateMachine.pushText(child);
                  continue;
                }
                switch (child.type) {
                  case 'line_break':
                    this.stateMachine.pushTag('BR/');
                    break;
                  case 'tab':
                    this.stateMachine.pushText('\t');
                    break;
                  case 'space':
                    this.stateMachine.pushText(spaces((<TextSpace>child).chars || 1));
                    break;
                }
              }
            }

            this.stateMachine.pushTag('/EMB_SVG_TSPAN');
            break;
          }
        }
        this.stateMachine.pushTag('/EMB_SVG_TEXT');
      }
    }

    this.stateMachine.pushTag('/EMB_SVG');
  }

  async drawGToText(drawG: DrawG) {
    this.stateMachine.pushTag('HTML_MODE/');

    this.getStyle(drawG.styleName);

    let maxx = 0;
    let maxy = 0;
    for (const drawCustomShape of drawG.list) {
      const x2 = inchesToPixels(drawCustomShape.x) + inchesToPixels(drawCustomShape.width);
      const y2 = inchesToPixels(drawCustomShape.y) + inchesToPixels(drawCustomShape.height);
      if (maxx < x2) {
        maxx = x2;
      }
      if (maxy < y2) {
        maxy = y2;
      }
    }

    this.stateMachine.pushTag('EMB_SVG', {
      width: maxx,
      height: maxy,
      styleTxt: `width: ${maxx / 100}mm; height: ${maxy / 100}mm;`
    });

    for (const drawCustomShape of drawG.list) {
      this.stateMachine.pushTag('EMB_SVG_G', {
        x: inchesToPixels(drawCustomShape.x), y: inchesToPixels(drawCustomShape.y)
      });
      await this.drawCustomShape(drawCustomShape);
      this.stateMachine.pushTag('/EMB_SVG_G');
    }

    this.stateMachine.pushTag('/EMB_SVG');
    this.stateMachine.pushTag('MD_MODE/');

    this.stateMachine.pushTag('EMPTY_LINE/');
    this.stateMachine.pushTag('B');
    this.stateMachine.pushText('INSTEAD OF EMBEDDED DIAGRAM ABOVE USE EMBEDDED DIAGRAM FROM DRIVE AND PUT LINK TO IT IN THE DESCRIPTION. See: https://github.com/mieweb/wikiGDrive/issues/353');
    this.stateMachine.pushError('INSTEAD OF EMBEDDED DIAGRAM ABOVE USE EMBEDDED DIAGRAM FROM DRIVE AND PUT LINK TO IT IN THE DESCRIPTION. See: https://github.com/mieweb/wikiGDrive/issues/353');
    this.stateMachine.pushTag('/B');
    this.stateMachine.pushTag('BR/');
  }

  async drawFrameToText(drawFrame: DrawFrame) {
    if (drawFrame.object) { // TODO: MathML
      return;
    }
    if (drawFrame.image) {
      const baseFileName = getBaseFileName(drawFrame.image.href);
      const fileName = this.fileNameMap[baseFileName] || baseFileName;
      const imageLink = this.picturesDir + fileName;
      const altText = drawFrame.description?.value || '';
      const svgId = urlToFolderId(altText);

      if (svgId) {
        this.stateMachine.pushTag('SVG/', { href: 'gdoc:' + svgId });
      } else
      if (imageLink.endsWith('.svg')) {
        this.stateMachine.pushTag('SVG/', { href: imageLink, alt: altText });
        // this.stateMachine.pushTag(`<object type="image/svg+xml" data="${imageLink}"><img src="${imageLink}" /></object>`);
      } else {
        this.stateMachine.pushTag('IMG/', { href: imageLink, alt: altText });
        // this.stateMachine.pushTag(`![${altText}](${imageLink})`);
      }
    }
  }

  hasStyle(paragraph: TextParagraph, name: string) {
    if (paragraph.styleName === name) {
      return true;
    }
    const style = this.getStyle(paragraph.styleName);
    if (style.parentStyleName === name) {
      return true;
    }
    return false;
  }

/*
  isBold(styleName: string) {
    const style = this.getStyle(styleName);
    if (style.textProperties?.fontWeight === 'bold') {
      return true;
    }

    if (style.parentStyleName) {
      return this.isBold(style.parentStyleName);
    }

    return false;
  }
*/

  isCourier(styleName: string) {
    const style = this.getStyle(styleName);
    if (COURIER_FONTS.indexOf(style.textProperties?.fontName) > -1) {
      return true;
    }

    if (style.parentStyleName) {
      return this.isCourier(style.parentStyleName);
    }

    return false;
  }


  async paragraphToText(paragraph: TextParagraph): Promise<void> {
    const style = this.getStyle(paragraph.styleName);
    const listStyle = this.getListStyle(style.listStyleName);
    const bookmarkName = paragraph.bookmark?.name || null;

    if (this.hasStyle(paragraph, 'Heading_20_1')) {
      this.stateMachine.pushTag('H1', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
    } else
    if (this.hasStyle(paragraph, 'Heading_20_2')) {
      this.stateMachine.pushTag('H2', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
    } else
    if (this.hasStyle(paragraph, 'Heading_20_3')) {
      this.stateMachine.pushTag('H3', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
    } else
    if (this.hasStyle(paragraph, 'Heading_20_4')) {
      this.stateMachine.pushTag('H4', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
    } else
    if (this.isCourier(paragraph.styleName)) {
      this.stateMachine.pushTag('PRE', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
    } else {
      this.stateMachine.pushTag('P', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
    }

    let codeElementsCount = 0;
    let textElementsCount = 0;
    for (const paraChild of paragraph.list) {
      if (typeof paraChild === 'string') {
        textElementsCount++;
        continue;
      }
      if (paraChild.type === 'span') {
        const paraSpan = <TextSpan>paraChild;
        const spanStyle = this.getStyle(paraSpan.styleName);

        const innerTxt = getInnerText(paraSpan);
        if (isMarkdownMacro(innerTxt)) {
          continue;
        }
        if (COURIER_FONTS.indexOf(spanStyle.textProperties.fontName) > -1) {
          codeElementsCount++;
        }
      }
    }

    const onlyCodeChildren = codeElementsCount > 0 && codeElementsCount + textElementsCount === paragraph.list.length;
    if (onlyCodeChildren) {
      this.stateMachine.pushTag('PRE');
    }

/*    switch (this.top.mode) {
      case 'html':
        this.stateMachine.pushTag('P');
        break;
      case 'md':
        if (paragraph.styleName) {
          const spaces = inchesToSpaces(style.paragraphProperties?.marginLeft);
          if (spaces) {
            this.stateMachine.pushTag(spaces);
          }
        }
    }*/

    if (!this.isCourier(paragraph.styleName)) {
      if (style.textProperties?.fontWeight === 'bold') {
        this.stateMachine.pushTag('B');
      }
    }

    for (const child of paragraph.list) {
      if (typeof child === 'string') {
        this.stateMachine.pushText(child);
        continue;
      }
      switch (child.type) {
        case 'line_break':
          this.stateMachine.pushTag('BR/');
          break;
        case 'tab':
          this.stateMachine.pushText('\t');
          break;
        case 'space':
          this.stateMachine.pushText(spaces((<TextSpace>child).chars || 1));
          break;
        case 'span':
          {
            const span = <TextSpan>child;
            const spanStyle = this.getStyle(span.styleName);
            if (COURIER_FONTS.indexOf(spanStyle.textProperties.fontName) > -1 && onlyCodeChildren) {
              const span2 = Object.assign({}, span);
              span2.styleName = '';
              await this.spanToText(span2);
            } else if (COURIER_FONTS.indexOf(spanStyle.textProperties.fontName) > -1) {
              this.stateMachine.pushTag('CODE');
              const span2 = Object.assign({}, span);
              span2.styleName = '';
              await this.spanToText(span2);
              this.stateMachine.pushTag('/CODE');
            } else {
              await this.spanToText(span);
            }
          }
          break;
        case 'link':
          {
            const link = <TextLink>child;
            await this.linkToText(link);
          }
          break;
        case 'rect':
          {
            const rect = <DrawRect>child;
            if (rect.width === '100%') {
              this.stateMachine.pushTag('HR/');
            }
          }
          break;
        case 'draw_frame':
          await this.drawFrameToText(<DrawFrame>child);
          break;
        case 'draw_custom_shape':
          this.stateMachine.pushTag('HTML_MODE/');
          await this.drawCustomShape(<DrawCustomShape>child);
          this.stateMachine.pushTag('MD_MODE/');
          break;
        case 'draw_g':
          await this.drawGToText(<DrawG>child);
          break;
        case 'change_start':
          this.stateMachine.pushTag('CHANGE');
          break;
        case 'change_end':
          this.stateMachine.pushTag('/CHANGE');
          break;
      }
    }

    if (!this.isCourier(paragraph.styleName)) {
      if (style.textProperties?.fontWeight === 'bold') {
        this.stateMachine.pushTag('/B');
      }
    }

    if (onlyCodeChildren) {
      this.stateMachine.pushTag('/PRE');
    }

    if (this.hasStyle(paragraph, 'Heading_20_1')) {
      this.stateMachine.pushTag('/H1');
    } else
    if (this.hasStyle(paragraph, 'Heading_20_2')) {
      this.stateMachine.pushTag('/H2');
    } else
    if (this.hasStyle(paragraph, 'Heading_20_3')) {
      this.stateMachine.pushTag('/H3');
    } else
    if (this.hasStyle(paragraph, 'Heading_20_4')) {
      this.stateMachine.pushTag('/H4');
    } else
    if (this.isCourier(paragraph.styleName)) {
      this.stateMachine.pushTag('/PRE');
    } else {
      this.stateMachine.pushTag('/P');
    }
  }

  async tableCellToText(tableCell: TableCell): Promise<void> {
    this.stateMachine.pushTag('TD'); // colspan
    for (const child of tableCell.list) {
      switch (child.type) {
        case 'paragraph':
          await this.paragraphToText(<TextParagraph>child);
          break;
        case 'list':
          await this.listToText(<TextList>child);
          break;
        case 'table':
          await this.tableToText(<TableTable>child);
          break;
      }
    }
    this.stateMachine.pushTag('/TD');
  }

  async tableRowToText(tableRow: TableRow): Promise<void> {
    this.stateMachine.pushTag('TR');
    for (const tableCell of tableRow.cells) {
      await this.tableCellToText(tableCell);
    }
    this.stateMachine.pushTag('/TR');
  }

  async tableToText(table: TableTable): Promise<void> {
    this.stateMachine.pushTag('TABLE');
    for (const tableRow of table.rows) {
      await this.tableRowToText(tableRow);
    }
    this.stateMachine.pushTag('/TABLE');
  }

  async listToText(list: TextList): Promise<void> {
    const listStyle = this.getListStyle(list.styleName);

    const continueNumbering = list.continueNumbering === 'true';

    this.stateMachine.pushTag('UL', { listId: list.id, continueList: list.continueList, listStyle, continueNumbering });
    for (const listItem of list.list) {
      this.stateMachine.pushTag('LI', { listId: list.id });
      for (const item of listItem.list) {
        if (item.type === 'paragraph') {
          await this.paragraphToText(<TextParagraph>item);
        }
        if (item.type === 'list') {
          await this.listToText(<TextList>item);
        }
      }
      this.stateMachine.pushTag('/LI');
    }
    this.stateMachine.pushTag('/UL', { listId: list.id, listStyle });
  }

  async officeTextToText(content: OfficeText): Promise<void> {
    for (const child of content.list) {
      switch (child.type) {
        case 'paragraph':
          await this.paragraphToText(<TextParagraph>child);
          break;
        case 'table':
          await this.tableToText(<TableTable>child);
          break;
        case 'list':
          await this.listToText(<TextList>child);
          break;
        case 'toc':
          await this.tocToText(<TableOfContent>child);
          break;
      }
    }
  }

  private async rewriteHeaders(txt: string) {
    for (const id in this.stateMachine.headersMap) {
      const slug = this.stateMachine.headersMap[id];
      txt = txt.replace(new RegExp(id, 'g'), slug);
    }
    return txt;
  }

  setPicturesDir(picturesDir: string) {
    this.picturesDir = picturesDir;
  }

  setRewriteRules(rewriteRules: RewriteRule[]) {
    this.rewriteRules = rewriteRules;
    this.stateMachine.setRewriteRules(rewriteRules);
  }
}
