### Nested ordered list:

1. Get files to transform (does not exist in local_files.json, have different modifiedTime, are trashed), generate desireLocalPaths based on parents
2. If file is removed - remove .md file, remove images
3. If file is new (not exists in local_files.json) - add to localFiles, schedule for generation
4. If file exists but with different desireLocalPath:
   * Remove old .md, remove old images
   * Schedule for generation
   * Generate redir with old localPath
5. Remove dangling redirects
   * Another Test Indent
6. Check if there are any conflicts (same desireLocalPath)
7. Check if any conflicts can be removed
    
