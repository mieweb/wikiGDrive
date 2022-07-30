// This is in the script.  Make sure you update this with the next version number before deploying here: https://docs.google.com/document/d/1ICVsTdxvO5fkZe6wZy_Hug_nMZaS71ZLcGcP7K2mwXc/edit#heading=h.rsldzpmzud
const VERSION=14;

// To manage the deployment of this:
// Notes on the madness are here:
//    https://docs.google.com/document/d/1ICVsTdxvO5fkZe6wZy_Hug_nMZaS71ZLcGcP7K2mwXc/edit#
// Quick link to update Version Number:
//    https://console.cloud.google.com/apis/api/appsmarket-component.googleapis.com/googleapps_sdk?authuser=0&organizationId=309138717477&project=wikigdrive

function onOpen(e) {
    const menu = DocumentApp.getUi().createAddonMenu(); // Or DocumentApp or SlidesApp or FormApp.
    menu.addItem('Sync', 'markFileDirty');
    menu.addItem('Sidebar (ver:'+VERSION+')', 'showSidebar');
    menu.addToUi();
    Logger.log('onOpen ' + e.user.nickname); // e.user.email
}

function getRootFolder(fileId) {
    const file = DriveApp.getFileById(fileId);
    let parentFolder = null;
    let parents = file.getParents();
    while (parents.hasNext()) {
        parentFolder = parents.next();
//        console.log("Parent id:" + parentFolder.getId());  
        parents = parentFolder.getParents(); 

    }
    return parentFolder;
}


function getURL() {
    const scriptProperties = PropertiesService.getScriptProperties();
    let URL = scriptProperties.getProperty('API_URL');
    if (URL && URL.length) {
        URL = URL.replace(/\/$/, ''); // strip trailing /
        return URL;
    }
    return "https://wikigdrive.com"
}

function markFileDirty() {
    const URL = getURL();

    const ui = DocumentApp.getUi();
    const doc = DocumentApp.getActiveDocument();
    const rootFolder = getRootFolder(doc.getId())

    const data = {};

    const options = {
        method : 'post',
        contentType: 'application/json',
        // Convert the JavaScript object to a JSON string.
        payload : JSON.stringify(data)
    };
    UrlFetchApp.fetch(`${URL}/api/sync/${rootFolder.getId()}/${doc.getId()}`, options);
}

function showSidebar() { // https://developers.google.com/apps-script/guides/html#code.gs
    const scriptProperties = PropertiesService.getScriptProperties();
    const URL = getURL();
    const doc = DocumentApp.getActiveDocument();
    const rootFolder = getRootFolder(doc.getId())

    const html = `<iframe src="${URL}/gdocs/${rootFolder.getId()}/${doc.getId()}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;" ></iframe>`;

    const htmlOutput = HtmlService.createHtmlOutput(html);
    htmlOutput.setTitle('wikigdrive (' + VERSION + ')' );
    htmlOutput.setWidth(350)
    htmlOutput.addMetaTag('viewport', 'width=device-width, initial-scale=1');

//    var htmlOutput = HtmlService.createHtmlOutputFromFile('Index');
    DocumentApp.getUi().showSidebar(htmlOutput);
}

function doGet(e) {
  const params = JSON.stringify(e);
  return HtmlService.createHtmlOutput("Hellow to wikiGDrive!" + params);
}
