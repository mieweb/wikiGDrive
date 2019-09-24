import {assert} from 'chai';

import {LinkTranslator} from "../src/LinkTranslator";
import {FilesStructure} from "../src/FilesStructure";

describe('LinkTranslatorTest', () => {
  it('test convertToRelativePath', () => {

    const filesStructure = new FilesStructure();

    const linkTranslator = new LinkTranslator(filesStructure);

    assert.equal(linkTranslator.convertToRelativePath('example folder', 'resources/Diagram.svg'), '../example folder');
    assert.equal(linkTranslator.convertToRelativePath('example-folder/example-document.html', 'resources/Diagram.svg'), '../example-folder/example-document.html');
    assert.equal(linkTranslator.convertToRelativePath('external_files/ea624d62d6de42e48c45e28347dd8027.png', 'example folder/Example Document.md'), '../external_files/ea624d62d6de42e48c45e28347dd8027.png');
    assert.equal(linkTranslator.convertToRelativePath('resources', 'resources/Diagram.svg'), '../resources');
    assert.equal(linkTranslator.convertToRelativePath('resources/Diagram.svg', 'example folder/Example Document.md'), '../resources/Diagram.svg');
    assert.equal(linkTranslator.convertToRelativePath('resources/Diagram.svg', 'resources/Diagram.svg'), '.');
    assert.equal(linkTranslator.convertToRelativePath('resources/Diagram.svg', 'Wiki G Drive Project Overview.md'), 'resources/Diagram.svg');
    assert.equal(linkTranslator.convertToRelativePath('resources/Hello World.jpg', 'example folder/Example Document.md'), '../resources/Hello World.jpg');
    assert.equal(linkTranslator.convertToRelativePath('resources/Hello World.jpg', 'resources/Diagram.svg'), 'Hello World.jpg');
    assert.equal(linkTranslator.convertToRelativePath('wiki-g-drive-project-overview.html', 'example folder/Example Document.md'), '../wiki-g-drive-project-overview.html');
    assert.equal(linkTranslator.convertToRelativePath('wiki-g-drive-project-overview.html', 'resources/Diagram.svg'), '../wiki-g-drive-project-overview.html');
  });
});
