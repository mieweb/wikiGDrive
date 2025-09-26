# Release-based Deployment Control

This document describes how to control which version of the code is deployed to production using the GitHub release system.

## Overview

The production deployment system now supports deploying specific versions of the code without needing to reset the master branch. This is accomplished by specifying a deployment target in the release description.

## How it Works

When you create a GitHub release, the production deployment workflow will:

1. Check the release description for a deployment target specification
2. If found, checkout and deploy that specific commit/tag/branch
3. If not found, deploy the current commit (default behavior)

## Specifying a Deployment Target

To deploy a specific version, include the following line in your release description:

```
deploy-target: <commit-hash|tag|branch>
```

### Examples

**Deploy a specific commit:**
```
deploy-target: a1b2c3d4e5f6
```

**Deploy a specific tag:**
```
deploy-target: v2.15.14
```

**Deploy a specific branch:**
```
deploy-target: hotfix/security-patch
```

## Use Cases

### Rollback to Previous Version

To rollback to a previous release:

1. Create a new release with the title "Rollback to v2.15.14"
2. In the release description, add:
   ```
   deploy-target: v2.15.14
   
   Rolling back production to stable version due to issues with latest release.
   ```
3. Publish the release

### Deploy a Hotfix

To deploy a hotfix branch without merging to master:

1. Create a hotfix branch: `git checkout -b hotfix/critical-fix`
2. Make your changes and push the branch
3. Create a new release with the title "Hotfix: Critical Security Patch"
4. In the release description, add:
   ```
   deploy-target: hotfix/critical-fix
   
   Emergency deployment of security patch.
   ```
5. Publish the release

### Deploy for Testing

To deploy a specific commit for testing:

1. Find the commit hash you want to deploy
2. Create a new release with the title "Testing Deploy"
3. In the release description, add:
   ```
   deploy-target: abc123def456
   
   Deploying specific commit for testing purposes.
   ```
4. Publish the release

## Benefits

- **Safe Rollbacks**: Easily rollback to any previous version without touching master
- **Hotfix Deployment**: Deploy critical fixes without waiting for full merge cycle
- **Testing Flexibility**: Deploy specific versions for testing without disrupting development
- **Audit Trail**: All deployments are tracked through GitHub releases
- **No Master Branch Risk**: Never need to reset or force-push master branch

## Validation

The deployment workflow validates that the specified target exists before attempting deployment. If an invalid target is specified, the deployment will fall back to using the current commit and log a warning.

## Monitoring

You can verify which version is currently deployed by:

1. Checking the Docker container tags in production
2. Looking at the `GIT_SHA` environment variable in the running container
3. Reviewing the deployment logs in GitHub Actions

## Migration from Manual Process

Previously, deploying specific versions required:

1. Resetting master to the target commit
2. Creating a release from that reset
3. Resetting master back to its original state

With this new system, you simply:

1. Create a release with the deployment target specified
2. The system handles checkout and deployment automatically