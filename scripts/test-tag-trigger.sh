#!/bin/bash

# Test script to simulate Git tag trigger detection logic
# This helps developers test the tag detection logic locally

set -e

echo "🏷️  Testing Git Tag Trigger Detection Logic"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test cases for different trigger scenarios
test_scenarios=(
    "refs/heads/master:Branch push should skip"
    "refs/heads/feature/new-api:Feature branch should skip"
    "refs/tags/v1.0.0:Version tag should deploy"
    "refs/tags/v2.1.3:Version tag should deploy"
    "refs/tags/v1.0.0-beta:Pre-release tag should deploy"
    "refs/tags/release-1.0:Non-version tag should skip"
    "refs/pull/123/merge:Pull request should skip"
    ":Empty ref should skip"
)

echo ""
print_info "Testing Git tag detection logic with various scenarios..."
echo ""

for scenario in "${test_scenarios[@]}"; do
    IFS=':' read -r webhook_ref expected <<< "$scenario"
    
    echo "Testing: CODEBUILD_WEBHOOK_HEAD_REF='$webhook_ref'"
    
    # Simulate the pipeline logic
    if [[ "$webhook_ref" == refs/tags/v* ]]; then
        result="✅ Build triggered by version tag: $webhook_ref"
        release_version="${webhook_ref#refs/tags/}"
        result="$result (Release: $release_version)"
        status="DEPLOY"
    else
        result="❌ Build not triggered by version tag (v*). Skipping deployment."
        if [[ -n "$webhook_ref" ]]; then
            result="$result (Triggered by: $webhook_ref)"
        else
            result="$result (No webhook ref)"
        fi
        status="SKIP"
    fi
    
    # Check if result matches expectation
    if [[ "$expected" == *"✅"* && "$status" == "DEPLOY" ]] || [[ "$expected" == *"❌"* && "$status" == "SKIP" ]]; then
        print_success "$result"
    else
        print_error "UNEXPECTED: $result"
        print_error "Expected: $expected"
    fi
    
    echo ""
done

echo "🎯 Summary:"
echo "- Version tags (v*) trigger deployments"
echo "- All other refs (branches, PRs, non-version tags) are skipped"
echo "- This logic runs in the CodeBuild synth step"
echo ""

print_info "To create a release tag:"
echo "  git tag v1.0.0"
echo "  git push origin v1.0.0"
echo ""

print_info "To test this logic in the actual pipeline:"
echo "  1. Push a regular commit (should skip deployment)"
echo "  2. Create and push a version tag (should trigger deployment)"
echo "  3. Check CodeBuild logs for the tag detection output"
echo ""

print_success "Tag trigger detection logic test completed!"
