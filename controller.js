const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getAccessToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return callback(err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

function listFiles(auth) {
    var drive = google.drive({ version: 'v3', auth: auth });
    getFolderTree(drive, "", []);
}

function getFolderTree(drive, nextPageToken, folderList) {
    drive.files.list({
        pageToken: nextPageToken ? nextPageToken : "",
        pageSize: 1000,
        q: "mimeType='application/vnd.google-apps.folder'",
        fields: "files(id,name,parents),nextPageToken",
    }, (err, { data }) => {
        if (err) return console.log('The API returned an error: ' + err);
        // console.log(data);
        const token = data.nextPageToken;
        Array.prototype.push.apply(folderList, data.files);
        if (token) {
            getFolderTree(drive, token, folderList);
        } else {
            // This script retrieves a folder tree under this folder ID.
            const folderId = "131axXFNIWZhoOuPB2QIiU6tLuQXmExIn";

            const folderTree = function c(folder, folderSt, res) {
                let ar = folderList.filter(e => {
                    if(e.parents) {
                        return e.parents[0] == folder;
                    }
                });
                folderSt += folder + "#_aabbccddee_#";
                let arrayFolderSt = folderSt.split("#_aabbccddee_#");
                arrayFolderSt.pop();
                res.push(arrayFolderSt);
                ar.length == 0 && (folderSt = "");
                ar.forEach(e => c(e.id, folderSt, res));
                return res;
            }(folderId, "", []);

            // Output the folder tree.
            console.log(folderTree);
        }
    });
}

function listFileTree() {
    // Load client secrets from a local file.

    fs.readFile('credentials.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        // Authorize a client with credentials, then call the Google Drive API.
        authorize(JSON.parse(content), listFiles);
    });
}

module.exports.listFileTree = listFileTree;