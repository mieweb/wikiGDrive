import path from 'path';
import fs from 'fs';
import { MathMLToLaTeX } from 'mathml-to-latex';

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
import {MarkdownNodes, MarkdownTagNode, MarkdownTextNode} from './MarkdownNodes.ts';
import {inchesToPixels, inchesToSpaces, spaces} from './utils.ts';
import {extractPath} from './extractPath.ts';
import {mergeDeep} from './mergeDeep.ts';
import {RewriteRule} from './applyRewriteRule.ts';
import {isMarkdownMacro} from './macroUtils.ts';
import {postProcess} from './postprocess/postProcess.ts';

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

  public errors: string[] = [];
  private readonly styles: { [p: string]: Style } = {};
  public readonly links: Set<string> = new Set<string>();
  private readonly chunks: MarkdownNodes = new MarkdownNodes();
  private picturesDir = '';
  private picturesDirAbsolute = '';
  private rewriteRules: RewriteRule[] = [];

  constructor(private document: DocumentContent, private documentStyles: DocumentStyles, private fileNameMap: FileNameMap = {}) {
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

    for (const tableOfContent of this.document.body.text.list) {
      if (tableOfContent.type === 'toc') {
        await this.tocToText(this.chunks.body, <TableOfContent>tableOfContent);
      }
    }
    await this.officeTextToText(this.chunks.body, this.document.body.text);

    // text = this.processMacros(text);
    // text = this.fixBlockMacros(text);

    await postProcess(this.chunks, this.rewriteRules);

    const markdown = this.chunks.toString();
    return this.trimBreaks(markdown);
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
      }
    }

    return rows.join('\n');
  }

  getErrors() {
    return this.errors;
  }

  async tocToText(currentTagNode: MarkdownTagNode, tableOfContent: TableOfContent): Promise<void> {
    const tocNode = this.chunks.createNode('TOC', {});
    this.chunks.append(currentTagNode, tocNode);

    for (const paragraph of tableOfContent.indexBody.list) {
      await this.paragraphToText(tocNode, paragraph);
    }
  }

  async spanToText(currentTagNode: MarkdownTagNode, span: TextSpan): Promise<void> {
    const style = this.getStyle(span.styleName);

    if (COURIER_FONTS.indexOf(style.textProperties.fontName) > -1) {
      const block = this.chunks.createNode('CODE');
      this.chunks.append(currentTagNode, block);
      currentTagNode = block;
    }

    if (style.textProperties?.fontStyle === 'italic' && style.textProperties?.fontWeight === 'bold') {
      const block = this.chunks.createNode('BI');
      this.chunks.append(currentTagNode, block);
      currentTagNode = block;
    } else
    if (style.textProperties?.fontStyle === 'italic') {
      const block = this.chunks.createNode('I');
      this.chunks.append(currentTagNode, block);
      currentTagNode = block;
    } else
    if (style.textProperties?.fontWeight === 'bold') {
      const block = this.chunks.createNode('B');
      this.chunks.append(currentTagNode, block);
      currentTagNode = block;
    }

    for (const child of span.list) {
      if (typeof child === 'string') {
        this.chunks.appendText(currentTagNode, child);
        continue;
      }
      switch (child.type) {
        case 'line_break':
          this.chunks.append(currentTagNode, this.chunks.createNode('BR/'));
          break;
        case 'tab':
          this.chunks.appendText(currentTagNode, '\t');
          break;
        case 'space':
          this.chunks.appendText(currentTagNode, spaces((<TextSpace>child).chars || 1));
          break;
      }
    }
  }

  addLink(href: string) {
    if (href && !href.startsWith('#') && href.indexOf(':') > -1) {
      this.links.add(href);
    }
  }

  async linkToText(currentTagNode: MarkdownTagNode, link: TextLink): Promise<void> {
    let href = link.href;
    const id = urlToFolderId(href);
    if (id) {
      href = 'gdoc:' + id;
    }

    this.addLink(href);

    const block = this.chunks.createNode('A', { href: href });
    this.chunks.append(currentTagNode, block);
    currentTagNode = block;

    for (const child of link.list) {
      if (typeof child === 'string') {
        this.chunks.appendText(currentTagNode, child);
        continue;
      }
      switch (child.type) {
        case 'span':
          {
            await this.spanToText(currentTagNode, <TextSpan>child);
          }
          break;
      }
    }
  }

  async drawCustomShape(currentTagNode: MarkdownTagNode, drawCustomShape: DrawCustomShape) {
    // https://documentation.libreoffice.org/assets/Uploads/Documentation/en/Tutorials/CustomShapes7/Custom-Shape-Tutorial.odt
    // https://code.woboq.org/libreoffice/libreoffice/svx/source/customshapes/EnhancedCustomShape2d.cxx.html#1808
    // https://code.woboq.org/libreoffice/libreoffice/xmloff/source/draw/ximpcustomshape.cxx.html
    const style = this.getStyle(drawCustomShape.styleName);

    const logwidth = inchesToPixels(drawCustomShape.width);
    const logheight = inchesToPixels(drawCustomShape.height);

    const blockSvg = this.chunks.createNode('EMB_SVG', {
      width: logwidth,
      height: logheight
    });
    this.chunks.append(currentTagNode, blockSvg);

    for (const item of drawCustomShape.list) {
      if (item.type === 'draw_enhanced_geometry') {
        const enhancedGeometry = <DrawEnhancedGeometry>item;

        const blockSvgP = this.chunks.createNode('EMB_SVG_P/', {
          pathD: extractPath(enhancedGeometry, logwidth, logheight),
          style
        });
        this.chunks.append(blockSvg, blockSvgP);
      }
    }
    for (const item of drawCustomShape.list) {
      if (item.type === 'paragraph') {
        const paragraph = <TextParagraph>item;

        if (paragraph.list.length === 0) {
          continue;
        }

        const blockSvgText = this.chunks.createNode('EMB_SVG_TEXT');
        this.chunks.append(blockSvg, blockSvgText);

        for (const child of paragraph.list) {
          if (typeof child === 'string') {
            this.chunks.appendText(currentTagNode, child);
            continue;
          }
          switch (child.type) {
            case 'span':
            {
              const span = <TextSpan>child;

              const style = this.getStyle(span.styleName);

              const blockSvgTextSpan = this.chunks.createNode('EMB_SVG_TSPAN', {
                style
              });
              this.chunks.append(blockSvgText, blockSvgTextSpan);

              for (const child of span.list) {
                if (typeof child === 'string') {
                  this.chunks.appendText(blockSvgTextSpan, child);
                  continue;
                }
                switch (child.type) {
                  case 'line_break':
                    this.chunks.append(blockSvgTextSpan, this.chunks.createNode('BR/'));
                    break;
                  case 'tab':
                    this.chunks.appendText(blockSvgTextSpan, '\t');
                    break;
                  case 'space':
                    this.chunks.appendText(blockSvgTextSpan, spaces((<TextSpace>child).chars || 1));
                    break;
                }
              }
            }
            break;
          }
        }
      }
    }
  }

  async drawGToText(currentTagNode: MarkdownTagNode, drawG: DrawG) {
    const blockHtml = this.chunks.createNode('HTML_MODE/');
    this.chunks.append(currentTagNode, blockHtml);

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

    const blockSvg = this.chunks.createNode('EMB_SVG', {
      width: maxx,
      height: maxy,
      styleTxt: `width: ${maxx / 100}mm; height: ${maxy / 100}mm;`
    });
    this.chunks.append(blockHtml, blockSvg);
    // currentTagNode = blockSvg;

    for (const drawCustomShape of drawG.list) {
      const blockSvgGroup = this.chunks.createNode('EMB_SVG_G', {
        x: inchesToPixels(drawCustomShape.x), y: inchesToPixels(drawCustomShape.y)
      });
      this.chunks.append(blockSvg, blockSvgGroup);
      await this.drawCustomShape(blockSvgGroup, drawCustomShape);
    }

    const emptyLine = this.chunks.createNode('EMPTY_LINE/');
    emptyLine.comment = 'drawGToText: warning';
    this.chunks.append(currentTagNode, emptyLine);

    const blockWarning = this.chunks.createNode('B');
    this.chunks.append(currentTagNode, blockWarning);

    this.chunks.appendText(blockWarning, 'INSTEAD OF EMBEDDED DIAGRAM ABOVE USE EMBEDDED DIAGRAM FROM DRIVE AND PUT LINK TO IT IN THE DESCRIPTION. See: https://github.com/mieweb/wikiGDrive/issues/353');
    this.pushError('INSTEAD OF EMBEDDED DIAGRAM ABOVE USE EMBEDDED DIAGRAM FROM DRIVE AND PUT LINK TO IT IN THE DESCRIPTION. See: https://github.com/mieweb/wikiGDrive/issues/353');
  }

  async drawFrameToText(currentTagNode: MarkdownTagNode, drawFrame: DrawFrame) {
    if (drawFrame.object) {
      if (!this.picturesDir) {
        return;
      }
      if (drawFrame.object.href) {
        const filePath = path.join(this.picturesDirAbsolute, drawFrame.object.href.replace(/\s/g, '_') + '.xml');
        try {
          const mathMl = new TextDecoder().decode(fs.readFileSync(filePath));
          if (mathMl.indexOf('<math ') > -1) {
            const node = this.chunks.createNode('MATHML');
            const latex = MathMLToLaTeX.convert(mathMl);
            this.chunks.appendText(node, latex);
            this.chunks.append(currentTagNode, node);
          }
        } catch (err) {
          console.warn(err);
        }
      }
      return;
    }
    if (drawFrame.image) {
      const baseFileName = getBaseFileName(drawFrame.image.href);
      const fileName = this.fileNameMap[baseFileName] || baseFileName;
      const imageLink = this.picturesDir + fileName;
      const altText = drawFrame.description?.value || '';
      const svgId = urlToFolderId(altText);

      if (svgId) {
        const node = this.chunks.createNode('SVG/', { href: 'gdoc:' + svgId });
        this.chunks.append(currentTagNode, node);
      } else
      if (imageLink.endsWith('.svg')) {
        const node = this.chunks.createNode('SVG/', { href: imageLink, alt: altText });
        this.chunks.append(currentTagNode, node);
      } else {
        const node = this.chunks.createNode('IMG/', { href: imageLink, alt: altText });
        this.chunks.append(currentTagNode, node);
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


  async paragraphToText(currentTagNode: MarkdownTagNode, paragraph: TextParagraph): Promise<void> {
    const style = this.getStyle(paragraph.styleName);
    const listStyle = this.getListStyle(style.listStyleName);
    const bookmarkName = paragraph.bookmark?.name || null;

    if (this.hasStyle(paragraph, 'Heading_20_1')) {
      const header = this.chunks.createNode('H1', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
      this.chunks.append(currentTagNode, header);
      currentTagNode = header;
    } else
    if (this.hasStyle(paragraph, 'Heading_20_2')) {
      const header = this.chunks.createNode('H2', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
      this.chunks.append(currentTagNode, header);
      currentTagNode = header;
    } else
    if (this.hasStyle(paragraph, 'Heading_20_3')) {
      const header = this.chunks.createNode('H3', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
      this.chunks.append(currentTagNode, header);
      currentTagNode = header;
    } else
    if (this.hasStyle(paragraph, 'Heading_20_4')) {
      const header = this.chunks.createNode('H4', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
      this.chunks.append(currentTagNode, header);
      currentTagNode = header;
    } else
    if (this.isCourier(paragraph.styleName)) {
      const block = this.chunks.createNode('PRE', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
      this.chunks.append(currentTagNode, block);
      currentTagNode = block;
    } else {
      const block = this.chunks.createNode('P', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
      this.chunks.append(currentTagNode, block);
      currentTagNode = block;
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
      currentTagNode.tag = 'PRE';
    }

    if (!this.isCourier(paragraph.styleName)) {
      if (style.textProperties?.fontWeight === 'bold') {
        const block = this.chunks.createNode('B', {});
        this.chunks.append(currentTagNode, block);
        currentTagNode = block;
      }
    }

    for (const child of paragraph.list) {
      if (typeof child === 'string') {
        this.chunks.appendText(currentTagNode, child);
        continue;
      }
      switch (child.type) {
        case 'line_break':
          this.chunks.append(currentTagNode, this.chunks.createNode('BR/', {}));
          break;
        case 'tab':
          this.chunks.appendText(currentTagNode, '\t');
          break;
        case 'space':
          this.chunks.appendText(currentTagNode, spaces((<TextSpace>child).chars || 1));
          break;
        case 'span':
          {
            const span = <TextSpan>child;
            const spanStyle = this.getStyle(span.styleName);
            if (COURIER_FONTS.indexOf(spanStyle.textProperties.fontName) > -1 && onlyCodeChildren) {
              const span2 = Object.assign({}, span);
              span2.styleName = '';
              await this.spanToText(currentTagNode, span2);
            } else if (COURIER_FONTS.indexOf(spanStyle.textProperties.fontName) > -1) {
              const codeBlock = this.chunks.createNode('CODE');
              this.chunks.append(currentTagNode, codeBlock);
              const span2 = Object.assign({}, span);
              span2.styleName = '';
              await this.spanToText(codeBlock, span2);
            } else {
              await this.spanToText(currentTagNode, span);
            }
          }
          break;
        case 'link':
          {
            const link = <TextLink>child;
            await this.linkToText(currentTagNode, link);
          }
          break;
        case 'rect':
          {
            const rect = <DrawRect>child;
            if (rect.width === '100%') {
              const node = this.chunks.createNode('HR/');
              this.chunks.append(currentTagNode, node);
            }
          }
          break;
        case 'draw_frame':
          await this.drawFrameToText(currentTagNode, <DrawFrame>child);
          break;
        case 'draw_custom_shape':
          {
            const htmlBlock = this.chunks.createNode('HTML_MODE/');
            this.chunks.append(currentTagNode, htmlBlock);
            await this.drawCustomShape(htmlBlock, <DrawCustomShape>child);
          }
          break;
        case 'draw_g':
          await this.drawGToText(currentTagNode, <DrawG>child);
          break;
        case 'change_start':
          this.chunks.append(currentTagNode, this.chunks.createNode('CHANGE_START'));
          break;
        case 'change_end':
          this.chunks.append(currentTagNode, this.chunks.createNode('CHANGE_END'));
          break;
      }
    }
  }

  async tableCellToText(currentTagNode: MarkdownTagNode, tableCell: TableCell): Promise<void> {
    const block = this.chunks.createNode('TD');
    this.chunks.append(currentTagNode, block);
    currentTagNode = block;

    for (const child of tableCell.list) {
      switch (child.type) {
        case 'paragraph':
          await this.paragraphToText(currentTagNode, <TextParagraph>child);
          break;
        case 'list':
          await this.listToText(currentTagNode, <TextList>child);
          break;
        case 'table':
          await this.tableToText(currentTagNode, <TableTable>child);
          break;
      }
    }
  }

  async tableRowToText(currentTagNode: MarkdownTagNode, tableRow: TableRow): Promise<void> {
    const block = this.chunks.createNode('TR');
    this.chunks.append(currentTagNode, block);
    currentTagNode = block;
    for (const tableCell of tableRow.cells) {
      await this.tableCellToText(currentTagNode, tableCell);
    }
  }

  async tableToText(currentTagNode: MarkdownTagNode, table: TableTable): Promise<void> {
    const blockHtml = this.chunks.createNode('HTML_MODE/');
    this.chunks.append(currentTagNode, blockHtml);

    const block = this.chunks.createNode('TABLE');
    this.chunks.append(blockHtml, block);
    currentTagNode = block;
    for (const tableRow of table.rows) {
      await this.tableRowToText(currentTagNode, tableRow);
    }
  }

  async listToText(currentTagNode: MarkdownTagNode, list: TextList): Promise<void> {
    const listStyle = this.getListStyle(list.styleName);

    const continueNumbering = list.continueNumbering === 'true';

    const ulBlock = this.chunks.createNode('UL', { listId: list.id, continueList: list.continueList, listStyle, continueNumbering });
    this.chunks.append(currentTagNode, ulBlock);

    for (const listItem of list.list) {
      const liBlock = this.chunks.createNode('LI', { listId: list.id });
      this.chunks.append(ulBlock, liBlock);

      for (const item of listItem.list) {
        if (item.type === 'paragraph') {
          await this.paragraphToText(liBlock, <TextParagraph>item);
        }
        if (item.type === 'list') {
          await this.listToText(liBlock, <TextList>item);
        }
      }
    }
  }

  async officeTextToText(currentTagNode: MarkdownTagNode, content: OfficeText): Promise<void> {
    for (const child of content.list) {
      switch (child.type) {
        case 'paragraph':
          await this.paragraphToText(currentTagNode, <TextParagraph>child);
          break;
        case 'table':
          await this.tableToText(currentTagNode, <TableTable>child);
          break;
        case 'list':
          await this.listToText(currentTagNode, <TextList>child);
          break;
        case 'toc':
          await this.tocToText(currentTagNode, <TableOfContent>child);
          break;
      }
    }
  }

  setPicturesDir(picturesDir: string, picturesDirAbsolute?: string) {
    this.picturesDir = picturesDir;
    this.picturesDirAbsolute = picturesDirAbsolute || picturesDir;
  }

  setRewriteRules(rewriteRules: RewriteRule[]) {
    this.rewriteRules = rewriteRules;
  }

  pushError(error: string) {
    this.errors.push(error);
  }

}
