# Google doc extensions to trigger wikigdoc sync from the docs menu 

## Browse Apps Script projects

https://script.google.com/home

## Develop script

New Project

Note: use old editor

### Setting scopes: https://developers.google.com/apps-script/concepts/scopes#legacy-editor_1

1. View -> Show manifest file
2. File -> Project properties -> Scopes
3. File -> Project properties -> Script properties, set API_URL="https://hostlocation.com:port"  (testing localhost:port)

   For production: https://google-drive-iframe.wikigdrive.com/


## Test Script

Top menu -> Run -> Test as add-on...

1. SELECT VERSION: Test with the latest code
2. INSTALLATION CONFIG: Installed for current user
3. Select Doc
4. Save
5. Test

