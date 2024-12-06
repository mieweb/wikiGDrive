const Prism = window['Prism'];

const url = /\b([a-z]{3,7}:\/\/|tel:)[\w\-+%~/.:=&@]+(?:\?[\w\-+%~/.:=?&!$'()*,;@]*)?(?:#[\w\-+%~/.:#=?&!$'()*,;@]*)?/;
const email = /\b\S+@[\w.]+[a-z]{2}/;
const linkMd = /\[([^\]]+)]\(([^)]+)\)/;

// Tokens that may contain URLs and emails
const candidates = ['comment', 'node:url', 'attr-value', 'string', 'front-matter'];

// Prism.languages.markdown.url.inside['url-link'] = Prism.languages.markdown.url.inside['node:url'];
// delete Prism.languages.markdown.url.inside['node:url'];
// Prism.languages.markdown['url-reference'].alias = 'url-link';

Prism.languages.markdown.urlOuter = Prism.languages.markdown.url;
delete Prism.languages.markdown.url;

Prism.languages.markdown['front-matter-block'].inside['front-matter'].inside = Prism.languages.markdown.urlOuter.inside;
Prism.languages.markdown['title'][1].inside.urlOuter = Prism.languages.markdown.urlOuter;

Prism.plugins.autolinker = {
  processGrammar: function (grammar) {
    // Abort if grammar has already been processed
    if (!grammar || grammar['url-link']) {
      return;
    }
    Prism.languages.DFS(grammar, function (key, def, type) {
      if (candidates.indexOf(type) > -1 && !Array.isArray(def)) {
        if (!def.pattern) {
          def = this[key] = {
            pattern: def
          };
        }

        def.inside = def.inside || {};
        if (type == 'front-matter-block') {
          def.inside['url-link'] = url;
        }
        if (type == 'comment') {
          def.inside['md-link'] = linkMd;
        }
        if (type == 'attr-value') {
          Prism.languages.insertBefore('inside', 'punctuation', { 'url-link': url }, def);
        } else {
          def.inside['url-link'] = url;
        }

        def.inside['email-link'] = email;
      }
    });
    grammar['url-link'] = url;
    grammar['email-link'] = email;
  }
};

Prism.hooks.add('before-highlight', function (env) {
  Prism.plugins.autolinker.processGrammar(env.grammar);
});

Prism.hooks.add('wrap', function (env) {
  function removeHash(url) {
    url = (url || '').replace(/#.*$/, '');
    return url;
  }

  if ('node:url' === env.type) {
    env.tag = 'a';
    env.attributes.href = removeHash(env.content);
    env.attributes['data-to-rewrite'] = 'true';
  }
  if (/-link$/.test(env.type)) {
    env.tag = 'a';

    let href = env.content;

    if (env.type == 'email-link' && href.indexOf('mailto:') != 0) {
      href = 'mailto:' + href;
    } else if (env.type == 'md-link') {
      const match = env.content.match(linkMd);
      href = match[2];
      env.content = match[1];
    }

    env.attributes.href = href;
    try {
      env.content = decodeURIComponent(env.content);
    } catch (e) { /* noop */ }
  }
});

Prism.manual = true;

export {Prism};
