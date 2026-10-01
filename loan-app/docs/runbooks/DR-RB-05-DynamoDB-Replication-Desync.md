# PaySecure Gateway Private Limited
## Disaster Recovery Runbook: DR-RB-05
# Scenario: DynamoDB Global Table Replication Desynchronization & Conflict Resolution

| Document ID | Severity Level | Target RTO | Target RPO | Authorized Roles |
| :--- | :--- | :--- | :--- | :--- |
| **DR-RB-05** | **SEV-2 (HIGH)** | **< 5 Minutes** | **< 100ms** | NoSQL Data Architect, Senior SRE |

---

## 1. Trigger Conditions
* **Trigger A:** CloudWatch Alarm `DynamoDBReplicationLatency` between Mumbai and Hyderabad exceeds **1,500ms** for 3 consecutive evaluation periods.
* **Trigger B:** Ingress API logs report `IdempotencyConflictException` where identical merchant order IDs are processed concurrently in both regions with conflicting payload versions.
* **Trigger C:** AWS Personal Health Dashboard alerts on internal DynamoDB replication partition lag in `ap-south-1`.

---

## 2. Impact Assessment
DynamoDB Global Tables handle critical state:
1. `IdempotencyKeyStore`: Prevents duplicate payment creation.
2. `TokenVaultMetadata`: Card token mapping to network token IDs.
3. `SessionState`: Active checkout browser sessions.
If replication desync occurs, concurrent payments might bypass deduplication checks.

---

## 3. Emergency Mitigation & Reconciliation

### Step 3.1: Enforce Regional Affinity via Sticky Ingress
Prevent concurrent requests for the same merchant from landing in different regions by updating CloudFront Edge Lambda / CloudFront Functions to route deterministically:

```bash
# Update CloudFront Function to hash MerchantID to specific region
aws cloudfront update-function \
    --name RouteByMerchantHash \
    --function-config '{"Comment":"Hash routing to prevent cross-region write races","Runtime":"cloudfront-js-2.0"}' \
    --function-code fileb://edge_scripts/route_by_merchant.js \
    --if-match $CF_ETAG
```

### Step 3.2: Isolate Desynchronized Partitions
```bash
# Identify lagging replication regions
aws dynamodb describe-table \
    --table-name paysecure-idempotency-table \
    --region ap-south-1 \
    --query 'Table.Replicas[?RegionName==`ap-south-2`].ReplicaStatus'
```

### Step 3.3: Run Automated LWW Conflict Audit Script
```bash
python3 /opt/paysecure/scripts/dynamo_conflict_resolver.py \
    --table paysecure-idempotency-table \
    --region-primary ap-south-1 \
    --region-secondary ap-south-2 \
    --resolve-strategy HIGHEST_VERSION_WINS
```
* **Resolution Rule:** If version conflict is detected:
  - If status in either region is `SUCCESS`, persist `SUCCESS`.
  - Never allow a `FAILED` or `PROCESSING` state to overwrite an existing `SUCCESS` state.
