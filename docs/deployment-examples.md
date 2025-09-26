# Example Release Descriptions

This file provides examples of how to use the deployment control feature in GitHub releases.

## Example 1: Deploy Specific Tag (Rollback)

**Release Title:** Rollback to v2.15.14

**Release Description:**
```
deploy-target: v2.15.14

Rolling back production to stable version v2.15.14 due to critical issues discovered in v2.15.15.

This deployment will:
- Restore the stable codebase
- Fix the authentication issues reported in production
- Maintain data integrity

Once deployed, we will investigate the issues in v2.15.15 before the next release.
```

## Example 2: Deploy Hotfix Branch

**Release Title:** Emergency Security Patch

**Release Description:**
```
deploy-target: hotfix/security-cve-2024-001

Emergency deployment of security patch for CVE-2024-001.

This hotfix addresses:
- SQL injection vulnerability in user authentication
- Cross-site scripting vulnerability in file upload
- Privilege escalation in admin dashboard

The fix has been tested in staging and is ready for immediate production deployment.
```

## Example 3: Deploy Specific Commit

**Release Title:** Deploy Tested Build

**Release Description:**
```
deploy-target: a1b2c3d4e5f6789012345678901234567890abcd

Deploying specific commit that has been thoroughly tested in staging environment.

This commit includes:
- Performance improvements for large file processing
- Bug fixes for Google Drive synchronization
- UI improvements for mobile devices

Testing completed:
- ✅ Unit tests: 100% pass
- ✅ Integration tests: 100% pass
- ✅ Performance tests: Within acceptable limits
- ✅ Security scan: No vulnerabilities found
```

## Example 4: Regular Release (No Deploy Target)

**Release Title:** WikiGDrive v2.16.0

**Release Description:**
```
New features and improvements in this release:

- Added support for collaborative editing
- Improved markdown rendering performance
- Enhanced file synchronization reliability
- New authentication options

Full changelog: https://github.com/mieweb/wikiGDrive/compare/v2.15.14...v2.16.0

This release will deploy the current codebase automatically.
```

## Example 5: Deploy Feature Branch for Testing

**Release Title:** Testing New File Processor

**Release Description:**
```
deploy-target: feature/new-file-processor

Deploying feature branch for production testing of the new file processing engine.

⚠️ This is a testing deployment and may be unstable.

Changes in this branch:
- Rewritten file processing pipeline
- Improved error handling and recovery
- Better memory management for large files

Monitoring required:
- Watch for memory usage spikes
- Monitor file processing times
- Check error logs for any issues

Plan to rollback if issues are detected within 2 hours.
```