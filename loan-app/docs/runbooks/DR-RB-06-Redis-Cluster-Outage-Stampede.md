# PaySecure Gateway Private Limited
## Disaster Recovery Runbook: DR-RB-06
# Scenario: ElastiCache Redis Cluster Outage & Cache Stampede Mitigation

| Document ID | Severity Level | Target RTO | Target RPO | Authorized Roles |
| :--- | :--- | :--- | :--- | :--- |
| **DR-RB-06** | **SEV-2 (HIGH)** | **< 2 Minutes** | **N/A (Ephemeral Cache)** | Lead Cache Architect, SRE Duty Lead |

---

## 1. Trigger Conditions
* **Trigger A:** Primary Redis Cluster `paysecure-redis-mum` in `ap-south-1` experiences multi-node failure or memory fragmentation panic (`EngineCPUUtilization` > 95%, `CurrConnections` drops to 0).
* **Trigger B:** Cache miss rate spikes from normal baseline (<2%) to **> 85%**, causing database connection pool exhaustion on Aurora PostgreSQL as thousands of concurrent queries attempt to rebuild merchant routing caches.

---

## 2. Emergency Assessment & Circuit Breaking
1. **Activate Circuit Breaker on Backend DB Querying:**
   Immediately protect Aurora PostgreSQL from thundering herd / cache stampede by engaging in-memory Circuit Breakers in application pods (Resilience4j / Envoy circuit breakers).

```bash
# Update ConfigMap to force local in-memory fallback cache
kubectl --context=$EKS_CTX_MUM patch configmap app-cache-config -n payment-core \
    --type merge -p '{"data":{"CACHE_FALLBACK_MODE":"LOCAL_MEMORY_ONLY","CIRCUIT_BREAKER_TRIPPED":"true"}}'
```

---

## 3. Recovery Procedure

### Step 3.1: Promote Secondary Redis Cluster in Hyderabad
If Mumbai Redis cluster is unrecoverable, switch to Hyderabad ElastiCache Global Datastore replica:

```bash
# Promote Hyderabad replica to independent primary cluster
aws elasticache failover-global-replication-group \
    --global-replication-group-id paysecure-global-redis \
    --primary-region ap-south-2 \
    --primary-replication-group-id paysecure-redis-hyd
```

### Step 3.2: Rebuild Essential Caches (Controlled Warmup)
To prevent cold-cache stampede once new Redis instance is active, run the controlled cache pre-warmer:

```bash
# Run Kubernetes Job to warm top 1,000 high-volume merchant BIN tables and configs
kubectl --context=$EKS_CTX_HYD create job --from=cronjob/cache-prewarmer-job manual-warmup-$(date +%s) -n payment-core

# Verify job completion
kubectl --context=$EKS_CTX_HYD get jobs -n payment-core -w
```

### Step 3.3: Reset Application Circuit Breakers
```bash
kubectl --context=$EKS_CTX_HYD patch configmap app-cache-config -n payment-core \
    --type merge -p '{"data":{"CACHE_FALLBACK_MODE":"DISTRIBUTED_REDIS","CIRCUIT_BREAKER_TRIPPED":"false"}}'
```
