#!/bin/bash

# Test script for deployment target parsing
# This simulates the logic used in the GitHub Actions workflow

test_deployment_target_parsing() {
    local release_body="$1"
    local expected_target="$2"
    local test_name="$3"
    
    echo "Testing: $test_name"
    echo "Release body: $release_body"
    
    # Simulate the parsing logic
    if echo "$release_body" | grep -i "deploy-target:"; then
        target_ref=$(echo "$release_body" | grep -i "deploy-target:" | head -1 | sed -E 's/.*[Dd][Ee][Pp][Ll][Oo][Yy]-[Tt][Aa][Rr][Gg][Ee][Tt]:[[:space:]]*//' | awk '{print $1}')
        echo "Found deployment target: $target_ref"
        if [ "$target_ref" = "$expected_target" ]; then
            echo "✅ PASS: Correctly parsed target '$target_ref'"
        else
            echo "❌ FAIL: Expected '$expected_target', got '$target_ref'"
        fi
    else
        if [ "$expected_target" = "" ]; then
            echo "✅ PASS: No deployment target found (as expected)"
        else
            echo "❌ FAIL: Expected target '$expected_target' but found none"
        fi
    fi
    echo ""
}

# Test cases
test_deployment_target_parsing "deploy-target: v2.15.14" "v2.15.14" "Simple tag deployment"

test_deployment_target_parsing "Emergency fix

deploy-target: hotfix/security-patch

This deploys a critical security fix." "hotfix/security-patch" "Deployment target in multiline description"

test_deployment_target_parsing "Deploy-Target: a1b2c3d4e5f6" "a1b2c3d4e5f6" "Case insensitive matching"

test_deployment_target_parsing "Regular release without deployment target" "" "No deployment target specified"

test_deployment_target_parsing "deploy-target: main
Additional text here" "main" "Target with additional content"

echo "All deployment target parsing tests completed."