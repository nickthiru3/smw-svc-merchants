# Deployment Guide

**Guide**: Deploying the microservice to AWS environments

---

## Overview

This guide covers deploying the CDK stack to different environments (dev, staging, prod).

**Prerequisites:**

- ✅ AWS CLI configured with credentials
- ✅ CDK CLI installed (`npm install -g aws-cdk`)
- ✅ Environment configuration files in `config/`

---

## Deployment Commands

### Deploy to Dev

```bash
npm run deploy:dev
```

### Deploy to Staging

```bash
npm run deploy:staging
```

### Deploy to Production

```bash
npm run deploy:prod
```

---

## Deployment Process

_To be documented as we implement Story 001_

Topics to cover:

- CDK bootstrap requirements
- Environment variable configuration
- Stack outputs and how to use them
- Rollback procedures
- Blue/green deployments (future)
- CI/CD integration

---

## Post-Deployment Verification

### Check Stack Outputs

```bash
cat outputs.json
```

### Test API Endpoint

```bash
export API_URL=$(cat outputs.json | jq -r '.["dev-merchants-ms-ServiceStack"].ApiUrl')
curl -X GET "${API_URL}/merchants?category=plastic"
```

### Check CloudWatch Logs

```bash
aws logs tail /aws/lambda/dev-merchants-ms-GetMerchantsByCategory --follow
```

---

## Story 001 Notes

**Deployment for Story 001**:

- Deployed to dev environment
- API Gateway URL published to SSM
- CloudWatch alarms configured

**See**: [Story 001 Implementation Log](./story-001-implementation-log.md)
