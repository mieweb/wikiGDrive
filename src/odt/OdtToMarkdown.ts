import {
  DocumentContent, DocumentStyles,
  DrawFrame,
  DrawRect, ListStyle,
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
} from './LibreOffice';
import {urlToFolderId} from '../utils/idParsers';
import {MarkdownChunks} from './MarkdownChunks';
import {StateMachine} from './StateMachine';
import {inchesToSpaces, spaces} from './utils';

function baseFileName(fileName) {
  return fileName.replace(/.*\//, '');
}

export class OdtToMarkdown {

  private readonly stateMachine: StateMachine;
  private readonly styles: { [p: string]: Style } = {};
  public readonly links: Set<string> = new Set<string>();
  private readonly chunks: MarkdownChunks = new MarkdownChunks();
  private picturesDir = '';

  constructor(private document: DocumentContent, private documentStyles: DocumentStyles) {
    this.stateMachine = new StateMachine(this.chunks);
  }

  getStyle(styleName): Style {
    if (!this.styles[styleName]) {
      const docStyle = this.documentStyles?.styles?.styles.find(a => a.name === styleName);
      if (docStyle) {
        return docStyle;
      }

      return {
        name: 'default',
        listStyleName: '',
        parentStyleName: '',
        paragraphProperties: new ParagraphProperty(),
        textProperties: new TextProperty()
      };
    }

    const parentStyle = this.getStyle(this.styles[styleName].parentStyleName);

    return Object.assign({}, parentStyle, this.styles[styleName]);
  }

  getListStyle(listStyleName): ListStyle {
    if (!this.documentStyles?.styles?.listStyles) {
      return null;
    }

    return this.documentStyles.styles.listStyles.find(ls => ls.name === listStyleName) || null;
  }

  async convert(): Promise<string> {
    if (this.document.automaticStyles) {
      for (const namedStyle of this.document.automaticStyles.styles) {
        this.styles[namedStyle.name] = namedStyle;
      }
    }

    for (const tableOfContent of this.document.body.text.list) {
      if (tableOfContent.type === 'toc') {
        await this.tocToText(<TableOfContent>tableOfContent);
      }
    }
    await this.officeTextToText(this.document.body.text);

    // text = this.processMacros(text);
    // text = this.fixBlockMacros(text);

    this.stateMachine.postProcess();

    return await this.rewriteHeaders(this.chunks.toString());
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
    if (style.textProperties?.fontStyle === 'italic' && style.textProperties?.fontWeight === 'bold') {
      this.stateMachine.pushTag('BI');
    } else
    if (style.textProperties?.fontStyle === 'italic') {
      this.stateMachine.pushTag('I');
    } else
    if (style.textProperties?.fontWeight === 'bold') {
      this.stateMachine.pushTag('B');
    }
    if (style.textProperties.fontName === 'Courier New') {
      this.stateMachine.pushTag('CODE');
    }

    for (const child of span.list) {
      if (typeof child === 'string') {
        this.stateMachine.pushText(child);
        continue;
      }
      switch (child.type) {
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
    if (style.textProperties.fontName === 'Courier New') {
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

  async drawFrameToText(drawFrame: DrawFrame) {
    if (drawFrame.object) { // TODO: MathML
      return;
    }
    if (drawFrame.image) {
      const imageLink = this.picturesDir + baseFileName(drawFrame.image.href);
      const altText = drawFrame.description?.value || '';
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
    if (style.textProperties?.fontName === 'Courier New') {
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

    if (this.isCourier(paragraph.styleName)) {
      this.stateMachine.pushTag('PRE', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
    } else {
      this.stateMachine.pushTag('P', { marginLeft: inchesToSpaces(style.paragraphProperties?.marginLeft), style, listStyle, bookmarkName });
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

    if (this.hasStyle(paragraph, 'Heading_20_1')) {
      this.stateMachine.pushTag('H1');
    }
    if (this.hasStyle(paragraph, 'Heading_20_2')) {
      this.stateMachine.pushTag('H2');
    }
    if (this.hasStyle(paragraph, 'Heading_20_3')) {
      this.stateMachine.pushTag('H3');
    }
    if (this.hasStyle(paragraph, 'Heading_20_4')) {
      this.stateMachine.pushTag('H4');
    }

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
      // string | TextLink | TextSpan | DrawRect | DrawFrame | TextTab
      switch (child.type) {
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
            if (spanStyle.textProperties.fontName === 'Courier New' && paragraph.list.length === 1) {
              this.stateMachine.pushTag('PRE');
              const span2 = Object.assign({}, span);
              span2.styleName = '';
              await this.spanToText(span2);
              this.stateMachine.pushTag('/PRE');
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
      }
    }

    if (!this.isCourier(paragraph.styleName)) {
      if (style.textProperties?.fontWeight === 'bold') {
        this.stateMachine.pushTag('/B');
      }
    }

    if (this.hasStyle(paragraph, 'Heading_20_1')) {
      this.stateMachine.pushTag('/H1');
    }
    if (this.hasStyle(paragraph, 'Heading_20_2')) {
      this.stateMachine.pushTag('/H2');
    }
    if (this.hasStyle(paragraph, 'Heading_20_3')) {
      this.stateMachine.pushTag('/H3');
    }
    if (this.hasStyle(paragraph, 'Heading_20_4')) {
      this.stateMachine.pushTag('/H4');
    }

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

    this.stateMachine.pushTag('UL', { counterId: list.id, listStyle, continueNumbering });
    for (const listItem of list.list) {
      this.stateMachine.pushTag('LI', { counterId: list.id, listStyle });
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
    this.stateMachine.pushTag('/UL', { counterId: list.id, listStyle });
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
}
