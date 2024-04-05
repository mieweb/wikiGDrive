import {marked} from 'marked';

export async function markdownToHtml(buffer: Buffer): Promise<string> {
  const renderer = {
    paragraph(text: string) {
      return `<p>${text}</p><br />\n`;
    }
    // code(code: string, infostring: string | undefined, escaped: boolean) {
    //   if (code.endsWith('\n')) {
    //     code = code + '\n';
    //   }
    //   return `<pre>\n${code}</pre>\n`;
    // },
    // link(href: string, title: string, text: string) {
    //   return `<a href="${href}">${text}</a>`;
    // },
    // image(href: string, title: string, text: string) {
    //   return `<img alt="${title}" src="${href}" />`;
    // },
    // heading(text, level) {
    //   const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');
    //   return `
    //         <h${level}><a id="${escapedText}" class="anchor" href="#${escapedText}"><span class="header-link"></span></a>${text}
    //         </h${level}>`;
    // }
  };

  marked.use({ renderer });

  const md = new TextDecoder().decode(buffer);
  const html = marked.parse(md, { pedantic: false, hooks: {
      preprocess: (markdown: string) => markdown,
      postprocess(html: string) {
        const style = '<style>\n.code { font-family: Courier, serif; }\n</style>\n';
        return `<html>\n<head>\n<meta content="text/html; charset=UTF-8" http-equiv="content-type" />\n${style}</head>\n<body>\n${html.trim()}\n</body>\n</html>\n`;
      }
    }
  });

  return html;
}
