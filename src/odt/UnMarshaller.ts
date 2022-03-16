import htmlparser2 from 'htmlparser2';

// TODO https://relaxng.org/relaxng.rng
// TODO namespaces

interface XmlClassType {
  _xmlTextField?: string;
  _elems: { [xmlElementTag: string]: {
      fieldName: string,
      classTypeName: string
    }};

  onOpenTag?(param: UnMarshaller, tagname: string, attributes: {[p: string]: string}): void;
  onText?(param: UnMarshaller, text: string): void;
  onCloseTag?(param: UnMarshaller, tagname: string): void;
}

interface StackPos<ValType> {
  val: ValType;
  classType: XmlClassType;
  closeTag: string;
}

interface XmlElementDef {
  fieldName: string;
  classTypeName: string;
  parentClassType?: any
  isArray: boolean;
}

function createObj(classType, attributes: {[xmlAttrName: string]: string}) {
  const obj = new classType();
  if (classType._attrs) {
    for (const xmlAttrName in attributes) {
      const attr = classType._attrs[xmlAttrName];
      if (attr) {
        const value = attributes[xmlAttrName];
        obj[attr.fieldName] = value;
      }
    }
  }
  return obj;
}

function addXmlHandlers(classType) {
  classType.onOpenTag = (context: UnMarshaller, xmlElementTag: string, attributes: {[xmlAttrName: string]: string}) => {
    if (!classType._elems) return;
    const elemDef: XmlElementDef = classType._elems[xmlElementTag];
    if (elemDef) {
      if (!elemDef.classTypeName || typeof elemDef.classTypeName !== 'string') {
        // context.parser.startIndex
        console.log('elemDef', xmlElementTag, elemDef);
        throw new Error('noClassType for tag: ' + xmlElementTag + ', fieldName: ' + elemDef.fieldName);
      }

      const subObj = createObj(context.getClass(elemDef.classTypeName), attributes);

      const obj = context.top.val;
      if (elemDef.isArray) {
        if (!Array.isArray(obj[elemDef.fieldName])) {
          obj[elemDef.fieldName] = [];
        }
        obj[elemDef.fieldName].push(subObj);
      } else {
        obj[elemDef.fieldName] = subObj;
      }

      context.push({
        val: subObj,
        classType: context.getClass(elemDef.classTypeName),
        closeTag: xmlElementTag
      });
    }
  };

  classType.onCloseTag = (context: UnMarshaller, xmlElementTag: string) => {
    if (context.top.closeTag === xmlElementTag) {
      context.pop();
    }
  };

  classType.onText = (context: UnMarshaller, text: string) => {
    const fieldName = context.top.classType._xmlTextField;
    if (fieldName) {
      const obj = context.top.val;
      const props = classType._xmlTextProps;

      if (props.isArray) {
        if (!obj[fieldName]) {
          obj[fieldName] = [];
        }
        obj[fieldName].push(text);
      } else {
        if (!obj[fieldName]) {
          obj[fieldName] = '';
        }
        obj[fieldName] += text;
      }
    }
  };
}

export function XmlRootElement(xmlElementTag) {
  return (classType) => {
    classType._xmlElementTag = xmlElementTag;
    addXmlHandlers(classType);
  };
}

export function XmlElement() {
  return (classType) => {
    addXmlHandlers(classType);
  };
}

export function XmlAttribute(xmlAttrName, fieldName) {
  return (classType) => {
    if (!classType._attrs) classType._attrs = {};
    classType._attrs[xmlAttrName] = {
      fieldName
    };
  };
}

export function XmlElementChild(xmlElementTag: string, fieldName: string, subClassTypeName: string, props: {isArray: boolean} = {isArray: false}) {
  if (!subClassTypeName) {
    throw new Error('No subClassType');
  }
  return (classType) => {
    if (!classType._elems) classType._elems = {};
    const xmlElemDef: XmlElementDef = {
      fieldName,
      classTypeName: subClassTypeName,
      ...props
    };
    classType._elems[xmlElementTag] = xmlElemDef;
  };
}

export function XmlText(fieldName, props: {isArray: boolean} = {isArray: false}) {
  return (classType) => {
    classType._xmlTextField = fieldName;
    classType._xmlTextProps = props;
  };
}

function createRootStackPos(rootClassTypeName: string, rootClassType): StackPos<any> {
  const val = { retVal: null };
  const classType: XmlClassType = {
    _elems: {
      [rootClassType._xmlElementTag]: {
        fieldName: 'retVal',
        classTypeName: rootClassTypeName,
      }
    }
  };

  addXmlHandlers(classType);

  return {
    val,
    classType,
    closeTag: ''
  };
}

export class UnMarshaller {
  public readonly parser: htmlparser2.Parser;
  private stack: StackPos<any>[] = [];

  constructor(private classes: {[name: string]: any}, private rootClassTypeName: string) {
    this.stack.push(createRootStackPos(this.rootClassTypeName, this.getClass(this.rootClassTypeName)));
    this.parser = new htmlparser2.Parser({
      onopentag: (tagname, attributes) => this.top.classType.onOpenTag(this, tagname, attributes),
      ontext: (text) => this.top.classType.onText(this, text),
      onclosetag: (tagname) => this.top.classType.onCloseTag(this, tagname),
    }, { xmlMode: true });
  }

  get top(): StackPos<any> {
    return this.stack[this.stack.length - 1];
  }

  public push(val: StackPos<any>) {
    this.stack.push(val);
  }

  public pop() {
    return this.stack.pop();
  }

  public unmarshal(content) {
    this.parser.write(content);
    this.parser.end();
    return this.top.val['retVal'];
  }

  getClass(classTypeName: string) {
    if (!this.classes[classTypeName]) {
      throw new Error('No class registered: ' + classTypeName);
    }
    return this.classes[classTypeName];
  }
}
