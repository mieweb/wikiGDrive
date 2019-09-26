import {assert} from 'chai';

import {LinkTranslator} from "../src/LinkTranslator";
import {FilesStructure} from "../src/FilesStructure";

describe('LinkTranslatorTest', () => {
  it('test convertToRelativePath', () => {

    const filesStructure = new FilesStructure();
    const linkTranslator = new LinkTranslator(filesStructure);

    assert.equal(linkTranslator.convertToRelativeSvgPath('example folder', 'resources/Diagram.svg'), '../example folder');
    assert.equal(linkTranslator.convertToRelativeSvgPath('example-folder/example-document.html', 'resources/Diagram.svg'), '../example-folder/example-document.html');
    assert.equal(linkTranslator.convertToRelativeSvgPath('resources', 'resources/Diagram.svg'), '../resources');
    assert.equal(linkTranslator.convertToRelativeSvgPath('resources/Diagram.svg', 'resources/Diagram.svg'), '.');
    assert.equal(linkTranslator.convertToRelativeSvgPath('resources/Hello World.jpg', 'resources/Diagram.svg'), 'Hello World.jpg');
    assert.equal(linkTranslator.convertToRelativeSvgPath('wiki-g-drive-project-overview.html', 'resources/Diagram.svg'), '../wiki-g-drive-project-overview.html');

    assert.equal(linkTranslator.convertToRelativeMarkDownPath('external_files/ea624d62d6de42e48c45e28347dd8027.png', 'example folder/Example Document.md'), '../external_files/ea624d62d6de42e48c45e28347dd8027.png');
    assert.equal(linkTranslator.convertToRelativeMarkDownPath('resources/Diagram.svg', 'example folder/Example Document.md'), '../resources/Diagram.svg');
    assert.equal(linkTranslator.convertToRelativeMarkDownPath('resources/Diagram.svg', 'Wiki G Drive Project Overview.md'), 'resources/Diagram.svg');
    assert.equal(linkTranslator.convertToRelativeMarkDownPath('resources/Hello World.jpg', 'example folder/Example Document.md'), '../resources/Hello World.jpg');
    assert.equal(linkTranslator.convertToRelativeMarkDownPath('wiki-g-drive-project-overview.html', 'example folder/Example Document.md'), '../wiki-g-drive-project-overview.html');

    linkTranslator.mode = 'dirURLs';

    assert.equal(linkTranslator.convertToRelativeMarkDownPath('example-folder/sample-conflict_1.md', 'example-folder/sample-conflict.md'), 'sample-conflict_1');

  });

  it('test convertExtension', () => {
    const filesStructure = new FilesStructure();
    const linkTranslator = new LinkTranslator(filesStructure);

    linkTranslator.mode = 'uglyURLs';

    assert.equal(linkTranslator.convertExtension('xxx/zzz/md'), 'xxx/zzz/md');
    assert.equal(linkTranslator.convertExtension('xxx/zzz/aaa.bbb.md'), 'xxx/zzz/aaa.bbb.html');
    assert.equal(linkTranslator.convertExtension('xxx/zzz/aaa'), 'xxx/zzz/aaa');
    assert.equal(linkTranslator.convertExtension('xxx/zzz/aaa.svg'), 'xxx/zzz/aaa.svg');

    linkTranslator.mode = 'dirURLs';

    assert.equal(linkTranslator.convertExtension('xxx/zzz/md'), 'xxx/zzz/md');
    assert.equal(linkTranslator.convertExtension('xxx/zzz/aaa.bbb.md'), 'xxx/zzz/aaa.bbb');
    assert.equal(linkTranslator.convertExtension('xxx/zzz/aaa'), 'xxx/zzz/aaa');
    assert.equal(linkTranslator.convertExtension('xxx/zzz/aaa.svg'), 'xxx/zzz/aaa.svg');

    assert.equal(linkTranslator.convertExtension('xxx/zzz/md'), 'xxx/zzz/md');

    linkTranslator.mode = 'mdURLs';

    assert.equal(linkTranslator.convertExtension('xxx/zzz/md'), 'xxx/zzz/md');
    assert.equal(linkTranslator.convertExtension('xxx/zzz/aaa.bbb.md'), 'xxx/zzz/aaa.bbb.md');
    assert.equal(linkTranslator.convertExtension('xxx/zzz/aaa'), 'xxx/zzz/aaa');
    assert.equal(linkTranslator.convertExtension('xxx/zzz/aaa.svg'), 'xxx/zzz/aaa.svg');
  });


});
