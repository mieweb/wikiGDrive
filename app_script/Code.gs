function onOpen(e) {
    const menu = DocumentApp.getUi().createAddonMenu(); // Or DocumentApp or SlidesApp or FormApp.
    menu.addItem('Sync', 'markFileDirty');
    menu.addItem('Sidebar', 'showSidebar');
    menu.addToUi();
    Logger.log('onOpen ' + e.user.nickname); // e.user.email
}

function markFileDirty() {
    console.log(JSON.stringify(ScriptApp.getOAuthToken()));
    console.log(JSON.stringify(ScriptApp.getIdentityToken()));
    const scriptProperties = PropertiesService.getScriptProperties();
    const URL = scriptProperties.getProperty('API_URL');

    const ui = DocumentApp.getUi();
    const doc = DocumentApp.getActiveDocument();
    ui.alert(doc.getId());

    const data = {};

    const options = {
        method : 'post',
        contentType: 'application/json',
        // Convert the JavaScript object to a JSON string.
        payload : JSON.stringify(data)
    };
    UrlFetchApp.fetch(`${URL}/file/${doc.getId()}/mark_dirty`, options);
}

function showSidebar() { // https://developers.google.com/apps-script/guides/html#code.gs
    const scriptProperties = PropertiesService.getScriptProperties();
    const URL = scriptProperties.getProperty('API_URL');
    const doc = DocumentApp.getActiveDocument();

    const html = `<iframe src="${URL}/file/${doc.getId()}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;" ></iframe>`;

    const htmlOutput = HtmlService.createHtmlOutput(html);
    htmlOutput.setTitle('wikigdrive');
    htmlOutput.addMetaTag('viewport', 'width=device-width, initial-scale=1');


//    var htmlOutput = HtmlService.createHtmlOutputFromFile('Index');
    DocumentApp.getUi().showSidebar(htmlOutput);
}
