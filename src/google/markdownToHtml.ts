import {marked} from 'marked';

export async function markdownToHtml(buffer: Buffer): Promise<string> {
  const renderer = {
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
  return marked.parse(md);
}
