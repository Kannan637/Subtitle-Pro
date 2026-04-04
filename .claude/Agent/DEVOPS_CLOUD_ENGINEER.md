# ☁️ DevOps / Cloud Engineer Guide — SubtitleAI Pro
> **Platform:** Antigravity | **Role:** DevOps / Cloud Engineer | **Version:** 1.0

---

## 📋 Table of Contents
1. [Role Overview](#role-overview)
2. [Tech Stack](#tech-stack)
3. [Infrastructure Architecture](#infrastructure-architecture)
4. [Environment Setup](#environment-setup)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Terraform Infrastructure as Code](#terraform-infrastructure-as-code)
7. [Container & Deployment Strategy](#container--deployment-strategy)
8. [Secrets Management](#secrets-management)
9. [Monitoring & Alerting](#monitoring--alerting)
10. [Scaling Strategy](#scaling-strategy)
11. [Backup & Disaster Recovery](#backup--disaster-recovery)
12. [Incident Response Runbook](#incident-response-runbook)
13. [Security Hardening](#security-hardening)
14. [Cost Management](#cost-management)
15. [Definition of Done](#definition-of-done)

---

## Role Overview

You are responsible for the **entire cloud infrastructure and delivery pipeline** of SubtitleAI Pro. You build and maintain the systems that allow the engineering team to ship fast and reliably, ensure 99.9% uptime, and keep costs in check as the platform scales.

**You own:**
- AWS infrastructure (provisioned via Terraform)
- CI/CD pipelines (GitHub Actions)
- Docker containerization and ECS Fargate deployment
- Database provisioning and automated backups
- Redis (Upstash) and BullMQ infrastructure
- CDN (CloudFront) and S3 lifecycle policies
- FFmpeg Lambda layer for video processing
- Monitoring, alerting (Datadog + PagerDuty)
- On-call rotation and incident response
- Security hardening (IAM, VPC, WAF, secrets)
- Cost monitoring and optimization

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Cloud Provider | **AWS** (primary) |
| IaC | **Terraform** + **Terragrunt** |
| Container Orchestration | **AWS ECS Fargate** |
| Container Registry | **Amazon ECR** |
| CI/CD | **GitHub Actions** |
| Frontend Deployment | **Vercel** (Next.js) |
| Database | **Amazon RDS PostgreSQL 16** (Multi-AZ) |
| Cache / Queue | **Upstash Redis** (serverless Redis) |
| Object Storage | **AWS S3** + **CloudFront** |
| Video Processing | **AWS Lambda** (FFmpeg layer) |
| Secrets | **AWS Secrets Manager** + **Doppler** |
| Monitoring | **Datadog** (APM, infra, logs) |
| Error Tracking | **Sentry** |
| Alerting | **PagerDuty** |
| DNS | **AWS Route 53** |
| SSL | **AWS ACM** (auto-renew) |
| WAF | **AWS WAF v2** |
| Antigravity | Deployment config, environment orchestration |

---

## Infrastructure Architecture

```
                        ┌─────────────────────────────────┐
                        │         Route 53 (DNS)          │
                        └──────────────┬──────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │          CloudFront CDN              │
                    │  (static assets + API edge caching)  │
                    └─────────────┬──────────┬────────────┘
                                  │          │
                         ┌────────▼──┐  ┌────▼──────────┐
                         │  Vercel   │  │  ALB (HTTPS)  │
                         │ (Next.js) │  │  + WAF v2     │
                         └───────────┘  └────┬──────────┘
                                             │
              ┌──────────────────────────────┼───────────────────┐
              │              VPC (ap-south-1)│                   │
              │   ┌───────────────────────────▼────────────┐     │
              │   │        ECS Fargate Cluster              │     │
              │   │  ┌─────────────┐  ┌──────────────────┐│     │
              │   │  │  API Tasks  │  │   Worker Tasks   ││     │
              │   │  │  (3 min)   │  │ (transcription,  ││     │
              │   │  │             │  │  translation,    ││     │
              │   │  │             │  │  media workers)  ││     │
              │   │  └──────┬──────┘  └────────┬─────────┘│     │
              │   └─────────┼──────────────────┼──────────┘     │
              │             │                  │                  │
              │   ┌─────────▼──────┐  ┌────────▼──────────┐     │
              │   │   RDS Postgres  │  │   Upstash Redis   │     │
              │   │   (Multi-AZ)   │  │ (BullMQ queues)   │     │
              │   └────────────────┘  └───────────────────┘     │
              │                                                    │
              │   ┌────────────────────────────────────────┐     │
              │   │              AWS S3                     │     │
              │   │  (media uploads + subtitle exports)     │     │
              │   └────────────────────────────────────────┘     │
              │                                                    │
              │   ┌────────────────────────────────────────┐     │
              │   │           Lambda (FFmpeg)               │     │
              │   │  (audio extraction + burn-in render)   │     │
              │   └────────────────────────────────────────┘     │
              └───────────────────────────────────────────────────┘
```

---

## Environment Setup

### Prerequisites
- AWS CLI v2 (`brew install awscli`)
- Terraform 1.8+ (`brew install terraform`)
- Terragrunt (`brew install terragrunt`)
- Docker Desktop
- GitHub CLI (`brew install gh`)
- Antigravity CLI (`npm install -g @antigravity/cli`)

### Initial Setup

```bash
# 1. Configure AWS CLI with dev profile
aws configure --profile subtitleai-dev
# Enter: Access Key, Secret Key, Region: ap-south-1, Format: json

# 2. Clone repo
git clone git@github.com:your-org/subtitleai-pro.git
cd subtitleai-pro/infra

# 3. Initialize Terraform
cd terraform/environments/staging
terragrunt init

# 4. Plan infrastructure
terragrunt plan

# 5. Apply (first time — will create all resources)
terragrunt apply

# 6. Deploy app to staging via Antigravity
ag deploy --env staging
```

---

## CI/CD Pipeline

### GitHub Actions Workflows

```
.github/workflows/
├── ci.yml              # Run on every PR: lint, test, build
├── deploy-staging.yml  # Run on merge to dev: deploy staging
├── deploy-prod.yml     # Run on release tag: deploy production
├── db-migrate.yml      # Run Prisma migrations on deploy
└── security-scan.yml   # Weekly OWASP ZAP scan
```

### `ci.yml` — Pull Request Checks

```yaml
name: CI

on:
  pull_request:
    branches: [dev, main, staging]

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: postgres }
        options: --health-cmd pg_isready
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma migrate deploy
        env: { DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test }
      - run: pnpm test --coverage
      - uses: codecov/codecov-action@v4

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### `deploy-staging.yml`

```yaml
name: Deploy to Staging

on:
  push:
    branches: [dev]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1

      - name: Login to ECR
        run: aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY

      - name: Build and push Docker image
        run: |
          docker build -t subtitleai-api:${{ github.sha }} ./backend
          docker tag subtitleai-api:${{ github.sha }} $ECR_REGISTRY/subtitleai-api:staging
          docker push $ECR_REGISTRY/subtitleai-api:staging

      - name: Run DB migrations
        run: |
          aws ecs run-task \
            --cluster subtitleai-staging \
            --task-definition subtitleai-migrate \
            --wait

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster subtitleai-staging \
            --service subtitleai-api \
            --force-new-deployment

      - name: Deploy frontend to Vercel
        run: vercel deploy --token=${{ secrets.VERCEL_TOKEN }} --env=staging

      - name: Notify Slack
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -d '{"text":"✅ Staging deployed: ${{ github.sha }}"}'
```

---

## Terraform Infrastructure as Code

### Directory Structure

```
infra/
├── terraform/
│   ├── modules/
│   │   ├── ecs-service/       # Reusable ECS service module
│   │   ├── rds/               # PostgreSQL setup
│   │   ├── s3-bucket/         # S3 + lifecycle + CORS
│   │   ├── cloudfront/        # CDN distribution
│   │   ├── lambda-ffmpeg/     # FFmpeg Lambda layer
│   │   └── waf/               # WAF rules
│   └── environments/
│       ├── staging/
│       │   ├── terragrunt.hcl
│       │   ├── ecs.tf
│       │   ├── rds.tf
│       │   └── s3.tf
│       └── production/
│           ├── terragrunt.hcl
│           └── ...
└── scripts/
    ├── build-ffmpeg-layer.sh
    └── rotate-secrets.sh
```

### Key Terraform Resources

```hcl
# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier           = "subtitleai-${var.env}"
  engine               = "postgres"
  engine_version       = "16.2"
  instance_class       = var.env == "production" ? "db.t4g.medium" : "db.t4g.small"
  allocated_storage    = 50
  max_allocated_storage = 500  # auto-scaling storage
  multi_az             = var.env == "production"
  deletion_protection  = var.env == "production"
  backup_retention_period = 7
  storage_encrypted    = true
  skip_final_snapshot  = var.env != "production"
}

# S3 bucket with lifecycle rules
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "free-tier-expiry"
    status = "Enabled"

    filter { prefix = "media/free/" }

    expiration { days = 90 }
  }

  rule {
    id     = "paid-tier-expiry"
    status = "Enabled"

    filter { prefix = "media/paid/" }

    expiration { days = 365 }
  }
}
```

---

## Container & Deployment Strategy

### Dockerfile (Backend)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 nodejs && adduser -S nodejs -u 1001
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
USER nodejs
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

### ECS Task Definitions

| Service | CPU | Memory | Desired Count | Auto-Scale |
|---------|-----|--------|---------------|------------|
| `subtitleai-api` | 512 | 1024 MB | 2 (staging) / 3 (prod) | CPU > 70% → +1 |
| `subtitleai-worker-transcription` | 1024 | 2048 MB | 2 | Queue depth > 10 → +2 |
| `subtitleai-worker-translation` | 512 | 1024 MB | 2 | Queue depth > 20 → +2 |
| `subtitleai-worker-media` | 1024 | 2048 MB | 1 | Queue depth > 5 → +1 |

### Blue/Green Deployment

Production uses AWS CodeDeploy blue/green:
1. New task definition deployed as "green" target group
2. ALB shifts 10% traffic to green → monitor for 5 min
3. If error rate < 1%: shift 100% to green
4. If error rate > 1%: auto-rollback to blue

---

## Secrets Management

All secrets stored in **AWS Secrets Manager**. Never in `.env` files in production.

```bash
# Store a secret
aws secretsmanager create-secret \
  --name "subtitleai/production/openai-api-key" \
  --secret-string "sk-..."

# Rotate a secret
./infra/scripts/rotate-secrets.sh --env production --secret openai-api-key

# ECS tasks fetch secrets at runtime via IAM role
# (configured in task definition secretsFrom field)
```

**Secret naming convention:**
```
subtitleai/{environment}/{service-name}/{key}

Examples:
subtitleai/production/backend/database-url
subtitleai/production/backend/stripe-secret-key
subtitleai/staging/backend/openai-api-key
```

**Never:**
- Commit secrets to Git
- Log secrets (even partially)
- Store secrets in S3 bucket
- Share secrets via Slack or email

---

## Monitoring & Alerting

### Datadog Dashboards to Maintain

1. **API Performance Dashboard**
   - Request rate (RPM)
   - p50 / p95 / p99 latency per endpoint
   - Error rate (4xx / 5xx)
   - Active connections

2. **Job Queue Dashboard**
   - Queue depth (transcription / translation / media)
   - Job processing time (p50 / p99)
   - Failed jobs count
   - Worker CPU/memory utilization

3. **Business Metrics Dashboard**
   - New signups per hour
   - Active transcription jobs
   - Credit consumption rate
   - Storage used (GB)

### Alert Rules (PagerDuty)

| Alert | Condition | Severity | On-call Response |
|-------|-----------|----------|-----------------|
| API error rate | > 2% over 5 min | P1 | Wake on-call immediately |
| API p99 latency | > 5s over 5 min | P1 | Wake on-call |
| Queue depth (transcription) | > 100 jobs for 10 min | P2 | Slack notification |
| Worker crash loop | > 3 restarts in 10 min | P1 | Wake on-call |
| RDS CPU | > 80% for 10 min | P2 | Slack notification |
| RDS storage | > 80% used | P1 | Wake on-call |
| S3 bucket 5xx errors | > 1% | P1 | Wake on-call |
| Lambda (FFmpeg) error rate | > 5% | P2 | Slack notification |
| Stripe webhook failures | Any | P1 | Wake on-call |
| SSL cert expiry | < 30 days | P2 | Slack (auto-renew via ACM should prevent) |

---

## Scaling Strategy

### Horizontal Scaling (ECS Auto Scaling)

```hcl
resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "api-cpu-scaling"
  service_namespace  = "ecs"
  resource_id        = "service/subtitleai-prod/subtitleai-api"
  scalable_dimension = "ecs:service:DesiredCount"
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    target_value = 70.0  # target 70% CPU
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
```

### Queue-Based Worker Scaling

Workers scale based on queue depth (custom CloudWatch metric from BullMQ):

```
Queue depth > 10 → add 1 transcription worker (ECS task)
Queue depth > 50 → add 3 transcription workers
Queue depth < 2 → scale down to minimum (2 workers)
Scale-in cooldown: 10 minutes (avoid thrashing)
```

### Database Read Replicas

At 50K+ active users:
- Add 1 RDS read replica
- Route all `SELECT` queries to replica via Prisma `$queryRawUnsafe` or Prisma replica extension
- Keep writes on primary

---

## Backup & Disaster Recovery

### Automated Backups

| Resource | Backup Method | Frequency | Retention |
|----------|--------------|-----------|-----------|
| RDS PostgreSQL | Automated snapshots | Daily | 7 days |
| RDS PostgreSQL | Manual snapshot | Before every release | 30 days |
| S3 media files | S3 versioning + replication | Continuous | 90 days |
| Redis (Upstash) | Daily snapshot | Daily | 3 days |
| Terraform state | S3 backend + versioning | On every apply | 90 days |

### Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| API service crash | < 5 min (ECS auto-restart) | 0 (stateless) |
| Worker service crash | < 2 min (BullMQ retry) | 0 (idempotent jobs) |
| RDS failure (single-AZ) | < 30 min (restore from snapshot) | < 24 hrs |
| RDS failure (Multi-AZ production) | < 2 min (automatic failover) | < 5 min |
| S3 data loss | < 1 hr (restore from versioning) | < 1 hr |
| Complete region failure | < 4 hrs (manual failover to eu-west-1) | < 1 hr |

### DR Drill (quarterly)
1. Simulate RDS failure → verify Multi-AZ failover
2. Delete test S3 objects → restore from versioning
3. Deploy to backup region (eu-west-1) → verify app functions

---

## Incident Response Runbook

### Severity Levels

| Sev | Definition | Response Time |
|-----|------------|---------------|
| SEV-1 | Platform down, all users affected | 15 min |
| SEV-2 | Major feature broken (upload/transcription), >20% users affected | 30 min |
| SEV-3 | Minor feature degraded, workaround available | 4 hrs |
| SEV-4 | Cosmetic / logging issue | Next sprint |

### SEV-1 Response Steps

```
1. PagerDuty alerts on-call engineer (5 min)
2. On-call joins #incident-response Slack channel (immediately)
3. On-call pings CTO + PM (immediately)
4. Identify impact scope (5 min):
   - Check Datadog dashboard
   - Check Sentry errors
   - Check ECS service health
   - Check RDS status
5. Communicate status (10 min):
   - Post in #status-updates: "We are investigating elevated errors"
   - Update status page (Statuspage.io)
6. Diagnose and fix (30-60 min)
7. Verify fix deployed to production
8. Post in #status-updates: "Issue resolved at [time]"
9. Update status page: Resolved
10. Write post-mortem within 48 hrs (template in Notion)
```

### Common Issues & Quick Fixes

| Symptom | Check | Fix |
|---------|-------|-----|
| API returning 502 | ECS service → check task status | Force new deployment: `aws ecs update-service --force-new-deployment` |
| Queue backed up | BullMQ dashboard → stuck jobs | Restart worker tasks; clear failed jobs if safe |
| RDS connections maxed | CloudWatch → `DatabaseConnections` | Restart API tasks (PgBouncer connection pooling — add if not present) |
| S3 upload failures | CloudTrail → S3 errors | Check IAM role permissions; S3 bucket policy |
| Whisper API errors | Check OpenAI status page | Drain transcription queue to Deepgram fallback |

---

## Security Hardening

### VPC Configuration
- All ECS tasks and RDS in **private subnets** only
- NAT Gateway for outbound internet (AI API calls)
- Security groups: ECS tasks allow inbound from ALB only; RDS allows inbound from ECS only

### IAM Principle of Least Privilege
```json
// ECS Task Role (API service) — minimal S3 permissions
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
  "Resource": "arn:aws:s3:::subtitleai-media-prod/media/${aws:userid}/*"
}
```

### WAF Rules (AWS WAF v2)
- Rate limiting: 1,000 requests per 5 min per IP
- AWS Managed Rules: `AWSManagedRulesCommonRuleSet`
- Block requests with SQL injection patterns
- Block requests with XSS patterns
- Geo-blocking: None (global product)
- Bot control: Challenge known bots

---

## Cost Management

### Monthly Cost Targets (at 5K users)

| Service | Estimated Cost |
|---------|---------------|
| ECS Fargate (API + workers) | $180/month |
| RDS PostgreSQL t4g.small | $50/month |
| S3 storage + transfer (1TB) | $80/month |
| CloudFront CDN | $40/month |
| AWS Lambda (FFmpeg) | $20/month |
| Upstash Redis | $20/month |
| Vercel (frontend) | $20/month |
| Datadog | $60/month |
| **Total infra** | **~$470/month** |

### Cost Optimization Rules
- [ ] S3 lifecycle rules: move to S3 Infrequent Access after 30 days, Glacier after 90 days
- [ ] Use Fargate Spot for worker tasks (up to 70% cheaper; workers are interruptible + retryable)
- [ ] RDS reserved instances after Month 3 (1-year term: ~30% discount)
- [ ] CloudFront cache subtitles aggressively (TTL 24h for immutable exports)
- [ ] Review Datadog costs monthly — remove unused metrics

### Weekly Cost Review
Every Monday: DevOps checks AWS Cost Explorer for anomalies.
Alert: Any daily spend > 2× previous-week daily average → investigate + notify CTO.

---

## Definition of Done

An infra/DevOps task is **done** when:
- [ ] Terraform changes applied to staging first
- [ ] Staging verified stable for ≥ 24 hrs before production apply
- [ ] Changes peer-reviewed via PR (no direct `terraform apply` to prod)
- [ ] Runbook updated in Notion if new failure mode introduced
- [ ] Alert added in Datadog for new service/resource
- [ ] Cost impact documented (new resources)
- [ ] Secrets stored in Secrets Manager (never in code)
- [ ] IAM roles use least-privilege permissions

---

> 📌 Questions? Ping `#devops` on Slack or tag `@devops-lead`.
> 🗺️ Architecture diagrams: [Notion link]
> 📟 On-call schedule: [PagerDuty link]
> 💰 AWS Cost Explorer: [link]
