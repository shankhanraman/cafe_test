# Frontend → Backend Connectivity (Option A) — Design

**Date:** 2026-06-22
**Status:** Approved
**Goal:** Make the deployed app fully functional end-to-end by letting the
CloudFront-hosted frontend reach the EKS-hosted backend API, with no CORS and no
frontend code changes.

## Problem

The two pipelines deploy two disconnected halves:

- **Frontend** is served over HTTPS from CloudFront (private S3 origin).
- **Backend** Service is `ClusterIP` — reachable only inside the EKS cluster.
- The frontend calls the API same-origin (`http-client.ts`:
  `BASE_URL = import.meta.env.VITE_API_URL ?? ''`), so in production it requests
  `https://<cloudfront>/api/...`. CloudFront has only the S3 origin, so `/api/*`
  falls through the SPA 404→`index.html` rule and every API call silently breaks.

Result: the UI loads but no data flows. Not functional end-to-end.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Public URL | Default CloudFront URL (`*.cloudfront.net`) | No domain/ACM/DNS work |
| Backend exposure | Service `type: LoadBalancer` (NLB) | No AWS Load Balancer Controller to install |
| Frontend↔backend | Single CloudFront domain, `/api/*` behavior → NLB | Same-origin → no CORS, no `VITE_API_URL` |
| NLB → CloudFront wiring | Terraform `kubernetes_service` data source | No manual hostname copy-paste |
| Apply model | Two-phase via `enable_api_origin` flag | NLB hostname only exists after backend deploys |

**Accepted tradeoff:** the internet-facing NLB makes the backend API directly
reachable (bypassing CloudFront). Acceptable for getting functional; can be
locked down later (security group / VPC origin).

## Architecture

```
                Users (browser, HTTPS)
                         │
                         ▼
                CloudFront (single public URL)
                 ├── default behavior  "/*"     → S3 bucket (static frontend)
                 └── ordered behavior  "/api/*" → NLB origin (backend API)
                         │                              │
                         ▼                              ▼
                 Private S3                     Internet-facing NLB
                                                       │
                                                       ▼
                                            backend pods :8080 (EKS)
                                                       │
                                                       ▼
                                            Postgres (in-cluster)
```

Both `/` and `/api/*` share the same CloudFront domain → the browser sees one
origin → no CORS, and the frontend keeps calling `/api/...` unchanged.

## Changes

### 1. `infra/k8s/backend/service.yaml` — expose via NLB
- `type: ClusterIP` → `type: LoadBalancer`.
- Annotations:
  - `service.beta.kubernetes.io/aws-load-balancer-type: "nlb"`
  - `service.beta.kubernetes.io/aws-load-balancer-scheme: "internet-facing"`
- Keep `port: 80` → `targetPort: 8080`.
- Synced by Argo CD; AWS provisions the NLB and populates its DNS hostname.

### 2. `infra/terraform/s3-frontend.tf` — add API route to CloudFront
- Second **custom origin** = NLB hostname, `origin_protocol_policy = "http-only"`
  (CloudFront → NLB over port 80).
- New **`ordered_cache_behavior`**: `path_pattern = "/api/*"`, forwards query
  strings + cookies + all headers (incl. `Authorization`), TTLs = 0 (no caching).
- Both wrapped in `dynamic` blocks gated by `var.enable_api_origin` so phase-1
  apply (no NLB yet) succeeds.

### 3. `infra/terraform/` — read the NLB hostname automatically
- `kubernetes` provider authenticated to EKS via `aws_eks_cluster` +
  `aws_eks_cluster_auth` data sources.
- `data "kubernetes_service" "backend"` (count-gated by `var.enable_api_origin`)
  reading `status.loadBalancer.ingress[0].hostname`.
- New variable `enable_api_origin` (default `false`) — the two-phase switch.

No frontend code changes. No CORS. No `VITE_API_URL`.

## Run procedure (two-phase)

**Phase 1 — infra + apps (`enable_api_origin = false`):**
1. `cd infra/terraform && terraform init`
2. `terraform apply` → VPC, EKS, ECR, S3, CloudFront (frontend-only), IAM
3. `aws eks update-kubeconfig --region us-east-1 --name <cluster>`
4. `kubectl create namespace cafe-test` + DB secrets (README step 4)
5. Install Argo CD + apply apps (README step 5)
6. Wait for the NLB hostname:
   `kubectl -n cafe-test get svc cafe-test-backend -w`
   (EXTERNAL-IP shows `*.elb.amazonaws.com`, ~2–3 min)

**Phase 2 — wire CloudFront → NLB (`enable_api_origin = true`):**
7. `terraform apply -var="enable_api_origin=true"` → reads NLB hostname, adds the
   2nd origin + `/api/*` behavior.
8. CloudFront redeploys (~5 min).

**Verify:**
9. `https://<cloudfront-domain>/` → app loads.
10. `https://<cloudfront-domain>/api/...` → returns data, no CORS errors.

After this, the normal CI/CD loop applies (push → Action → Argo CD). Phases 1–2
are not repeated unless infra changes.

## Out of scope
- Custom domain / ACM certificate / Route53.
- Locking the NLB down to CloudFront-only access.
- AWS Load Balancer Controller / ALB Ingress.
