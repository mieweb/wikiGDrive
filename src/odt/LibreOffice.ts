import {XmlAttribute, XmlElement, XmlElementChild, XmlRootElement, XmlText} from './UnMarshaller';

// TODO https://git.libreoffice.org/core/+/refs/heads/master/schema/libreoffice/OpenDocument-v1.3+libreoffice-schema.rng

interface TextSection {
  type: string;
}
interface ParagraphSection {
  type: string;
}

@XmlElement()
@XmlElementChild('text:p', 'list', 'TextParagraph', {isArray: true})
@XmlElementChild('table:table', 'list', 'TableTable', {isArray: true})
export class TableCell {
  list: Array<TextParagraph | TableTable> = [];
}

@XmlElement()
@XmlAttribute('table:number-columns-repeated', 'numberColumns')
export class TableColumn {
  numberColumns: number;
}

@XmlElement()
@XmlElementChild('table:table-cell', 'cells', 'TableCell', {isArray: true})
export class TableRow {
  cells: TableCell[] = [];
}

@XmlElement()
@XmlElementChild('table:table-column', 'columns', 'TableColumn', {isArray: true})
@XmlElementChild('table:table-row', 'rows', 'TableRow', {isArray: true})
export class TableTable implements TextSection {
  type = 'table';
  columns: TableColumn[] = [];
  rows: TableRow[] = [];
}

@XmlElement()
export class FontFaceDecl {
}

@XmlElement()
@XmlAttribute('text:c', 'chars')
export class TextSpace {
  type = 'space';
  chars: number;
}

@XmlElement()
@XmlAttribute('text:style-name', 'styleName')
@XmlText('list', {isArray: true})
@XmlElementChild('text:s', 'list', 'TextSpace', {isArray: true})
@XmlElementChild('text:tab', 'list', 'TextTab', {isArray: true})
@XmlElementChild('office:annotation', 'annotations', 'OfficeAnnotation', {isArray: true})
export class TextSpan implements ParagraphSection {
  type = 'span';
  annotations: OfficeAnnotation[] = [];
  list: Array<string | TextSpace | TextTab> = [];
  styleName: string;
}

@XmlElement()
@XmlAttribute('xlink:href', 'href')
@XmlAttribute('text:style-name', 'styleName')
@XmlElementChild('text:span', 'list', 'TextSpan', {isArray: true})
export class TextLink implements ParagraphSection {
  type = 'link';
  href = '';
  styleName: string;
  list: Array<string | TextSpan> = [];
}

@XmlElement()
@XmlAttribute('text:name', 'name')
export class TextBookmark {
  name: string;
}

/* Sample HR:
  text:anchor-type="as-char"
  style:rel-width="100%"
  draw:z-index="0"
  draw:style-name="gr1"
  draw:text-style-name="P26"
  svg:width="0.0012in"
  svg:height="0.0213in"
*/
@XmlElement()
@XmlAttribute('style:rel-width', 'width')
export class DrawRect implements ParagraphSection {
  type = 'rect';
  width: string;
}

@XmlElement()
@XmlAttribute('xlink:href', 'href')
export class DrawObject {
  href: string;
}

@XmlElement()
@XmlAttribute('xlink:href', 'href')
export class DrawImage {
  href: string;
}

@XmlElement()
@XmlText('value')
export class SvgDesc {
  value: string;
}

@XmlElement()
@XmlElementChild('draw:object', 'object', 'DrawObject')
@XmlElementChild('draw:image', 'image', 'DrawImage')
@XmlElementChild('svg:desc', 'desc', 'SvgDesc')
export class DrawFrame implements ParagraphSection {
  type = 'draw_frame';
  object?: DrawObject;
  image?: DrawImage;
  description?: SvgDesc;
}

@XmlElement()
export class TextTab implements ParagraphSection {
  type = 'tab';
}

@XmlElement()
@XmlText('list', {isArray: true})
@XmlAttribute('text:style-name', 'styleName')
@XmlElementChild('text:bookmark', 'bookmark', 'TextBookmark')
@XmlElementChild('text:a', 'list', 'TextLink', {isArray: true})
@XmlElementChild('text:span', 'list', 'TextSpan', {isArray: true})
@XmlElementChild('draw:rect', 'list', 'DrawRect', {isArray: true})
@XmlElementChild('draw:frame', 'list', 'DrawFrame', {isArray: true})
@XmlElementChild('text:tab', 'list', 'TextTab', {isArray: true})
@XmlElementChild('text:s', 'list', 'TextSpace', {isArray: true})
@XmlElementChild('office:annotation', 'annotations', 'OfficeAnnotation', {isArray: true})
export class TextParagraph implements TextSection {
  type = 'paragraph';
  bookmark: TextBookmark;
  list: Array<string | TextLink | TextSpan | DrawRect | DrawFrame | TextTab | TextSpace> = [];
  annotations: OfficeAnnotation[] = [];
  styleName: string;
}

@XmlElement()
@XmlElementChild('text:p', 'list', 'TextParagraph', {isArray: true})
export class TextIndexBody {
  list: Array<TextParagraph> = [];
}

@XmlElement()
@XmlElementChild('text:index-body', 'indexBody', 'TextIndexBody')
export class TableOfContent {
  type = 'toc';
  indexBody: TextIndexBody;
}

@XmlElement()
export class OfficeAnnotation {
}

@XmlElement()
@XmlElementChild('text:p', 'list', 'TextParagraph', {isArray: true})
@XmlElementChild('text:list', 'list', 'TextList', {isArray: true})
export class TextListItem {
  list: Array<TextParagraph | TextList> = [];
}

@XmlElement()
@XmlAttribute('text:style-name', 'styleName')
@XmlAttribute('xml:id', 'id')
@XmlElementChild('text:list-item', 'list', 'TextListItem', {isArray: true})
export class TextList implements TextSection {
  type = 'list';
  id?: string;
  list: Array<TextListItem> = [];
  styleName: string; // WWNum3 is for List Bullet. WWNum2 is for List Number. WWNum1 is for List Alpha
}

@XmlElement()
@XmlElementChild('text:p', 'list', 'TextParagraph', {isArray: true})
@XmlElementChild('text:list', 'list', 'TextList', {isArray: true})
@XmlElementChild('table:table', 'list', 'TableTable', {isArray: true})
@XmlElementChild('text:table-of-content', 'tableOfContent', 'TableOfContent', {isArray: true})
export class OfficeText {
  list: Array<TextParagraph | TableTable | TextList | TableOfContent> = [];
  tableOfContent: TableOfContent[] = [];
}

@XmlElement()
@XmlElementChild('office:text', 'text', 'OfficeText')
export class OfficeBody {
  text: OfficeText;
}

@XmlElement()
@XmlAttribute('style:font-name', 'fontName')
@XmlAttribute('fo:font-weight', 'fontWeight')
@XmlAttribute('fo:font-style', 'fontStyle')
@XmlAttribute('style:text-underline-style', 'underlineStyle')
export class TextProperty {
  fontName?: 'Courier New' | 'Arial';
  fontWeight?: 'bold';
  fontStyle?: 'italic';
  underlineStyle?: 'solid';
}

@XmlElement()
@XmlAttribute('fo:break-before', 'breakBefore')
@XmlAttribute('fo:break-after', 'breakAfter')
@XmlAttribute('fo:margin-left', 'marginLeft')
export class ParagraphProperty {
  breakBefore?: 'auto';
  breakAfter?: 'auto';
  marginLeft?: string;
}

@XmlElement()
@XmlAttribute('style:name', 'name')
@XmlAttribute('style:list-style-name', 'listStyleName')
@XmlAttribute('style:parent-style-name', 'parentStyleName')
@XmlElementChild('style:text-properties', 'textProperties', 'TextProperty')
@XmlElementChild('style:paragraph-properties', 'paragraphProperties', 'ParagraphProperty')
export class Style {
  name: string;
  listStyleName: string;
  parentStyleName: string;
  textProperties: TextProperty;
  paragraphProperties: ParagraphProperty;
}

@XmlElement()
@XmlElementChild('style:style', 'styles', 'Style', {isArray: true})
export class AutomaticStyle {
  styles: Style[];
}

@XmlRootElement('office:document-content')
@XmlElementChild('office:font-face-decls', 'fontFaceDecl', 'FontFaceDecl')
@XmlElementChild('office:body', 'body', 'OfficeBody')
@XmlElementChild('office:automatic-styles', 'automaticStyles', 'AutomaticStyle')
export class DocumentContent {
  body: OfficeBody;
  fontFaceDecl: FontFaceDecl[] = [];
  automaticStyles: AutomaticStyle;
}

@XmlElement()
@XmlAttribute('text:level', 'level')
export class ListLevelStyleBullet {
  level = 0;
}

@XmlElement()
@XmlAttribute('text:level', 'level')
export class  ListLevelStyleNumber {
  level = 0;
}

@XmlElement()
@XmlAttribute('style:name', 'name')
@XmlElementChild('text:list-level-style-bullet', 'listLevelStyleBullet', 'ListLevelStyleBullet', {isArray: true})
@XmlElementChild('text:list-level-style-number', 'listLevelStyleNumber', 'ListLevelStyleNumber', {isArray: true})
export class ListStyle {
  name: string;
  listLevelStyleBullet: ListLevelStyleBullet[] = [];
  listLevelStyleNumber: ListLevelStyleNumber[] = [];
}

@XmlElement()
@XmlElementChild('text:list-style', 'listStyles', 'ListStyle', {isArray: true})
export class OfficeStyles {
  listStyles: ListStyle[] = [];
}

@XmlRootElement('office:document-styles')
@XmlElementChild('office:styles', 'styles', 'OfficeStyles')
export class DocumentStyles {
  styles: OfficeStyles;
}

export const LIBREOFFICE_CLASSES = {
  'DocumentContent': DocumentContent,
  'OfficeBody': OfficeBody,
  'OfficeText': OfficeText,
  'OfficeAnnotation': OfficeAnnotation,
  'FontFaceDecl': FontFaceDecl,
  'AutomaticStyle': AutomaticStyle,
  'Style': Style,

  'ParagraphProperty': ParagraphProperty,
  'TextProperty': TextProperty,
  'TextParagraph': TextParagraph,
  'TextLink': TextLink,
  'TextSpan': TextSpan,
  'TextSpace': TextSpace,

  'TableOfContent': TableOfContent,
  'TextIndexBody': TextIndexBody,

  'TextList': TextList,
  'TextListItem': TextListItem,
  'TextBookmark': TextBookmark,
  'TextTab': TextTab,
  'DrawRect': DrawRect,
  'DrawFrame': DrawFrame,
  'DrawObject': DrawObject,
  'DrawImage': DrawImage,
  'SvgDesc': SvgDesc,

  'TableCell': TableCell,
  'TableColumn': TableColumn,
  'TableRow': TableRow,
  'TableTable': TableTable,

  'DocumentStyles': DocumentStyles,
  'OfficeStyles': OfficeStyles,
  'ListStyle': ListStyle,
  'ListLevelStyleNumber': ListLevelStyleNumber,
  'ListLevelStyleBullet': ListLevelStyleBullet
};
