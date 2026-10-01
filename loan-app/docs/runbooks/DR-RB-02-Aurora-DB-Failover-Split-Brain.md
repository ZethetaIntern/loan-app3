# PaySecure Gateway Private Limited
## Disaster Recovery Runbook: DR-RB-02
# Scenario: Aurora Database Failover & Split-Brain Mitigation

| Document ID | Severity Level | Target RTO | Target RPO | Authorized Roles |
| :--- | :--- | :--- | :--- | :--- |
| **DR-RB-02** | **SEV-1 (CRITICAL)** | **< 3 Minutes** | **< 1 Second** | Principal Database Architect, Lead SRE |

---

## 1. Trigger Conditions
* **Trigger A:** CloudWatch Alarm `AuroraPrimaryWriterUnresponsive`: Connection pool exhaustion, IOPS stall, or Aurora node crash on Mumbai primary (`paysecure-aurora-mumbai-writer`).
* **Trigger B:** Application errors `org.postgresql.util.PSQLException: Connection refused` spiking > 1,000 req/sec in Mumbai.
* **Trigger C (Split-Brain Risk):** Network partition between Mumbai and Hyderabad where both instances believe they have write authority.

---

## 2. Split-Brain Prevention Architecture (Node Fencing)
To strictly avoid dual primary writers and divergent ledgers:
1. **Fencing Mumbai Writer:** Before promoting Hyderabad or immediately upon detecting split-brain symptoms, revoke network access or set Mumbai parameter group to `default.aurora-postgresql15.read_only = 1`.
2. **Security Group Quarantine:** Immediately revoke security group ingress to Mumbai Aurora from all EKS worker nodes.

```bash
# Emergency Quarantine of Mumbai Aurora Security Group
aws ec2 revoke-security-group-ingress \
    --region ap-south-1 \
    --group-id sg-011223344mumbai_db \
    --protocol tcp --port 5432 \
    --source-group sg-088776655mumbai_eks_nodes
```

---

## 3. Unplanned Promotion Procedure

### Step 3.1: Verify Storage LSN & Promotion Readiness
```bash
# Check replication lag before promotion
aws rds describe-global-clusters \
    --global-cluster-identifier paysecure-global-db \
    --query 'GlobalClusters[0].GlobalClusterMembers'
```

### Step 3.2: Promote Hyderabad Secondary Cluster
```bash
# Promote the secondary cluster to standalone cluster
aws rds failover-global-cluster \
    --global-cluster-identifier paysecure-global-db \
    --target-db-cluster-identifier-arn arn:aws:rds:ap-south-2:112233445566:cluster:paysecure-aurora-hyd \
    --allow-data-loss

# Check cluster state until status is 'available'
aws rds describe-db-clusters \
    --region ap-south-2 \
    --db-cluster-identifier paysecure-aurora-hyd \
    --query 'DBClusters[0].[Status,Endpoint]' --output table
```

### Step 3.3: Point EKS Applications to Hyderabad Writer Endpoint
Update Kubernetes ConfigMap / ExternalName service to direct microservices to the new write endpoint:

```bash
kubectl --context=arn:aws:eks:ap-south-2:112233445566:cluster/paysecure-eks-hyd patch service db-primary-endpoint \
    -n payment-core \
    -p '{"spec":{"externalName":"paysecure-aurora-hyd.cluster-custom-xyz.ap-south-2.rds.amazonaws.com"}}'

# Rolling restart application pods to purge cached DB connection pools
kubectl --context=arn:aws:eks:ap-south-2:112233445566:cluster/paysecure-eks-hyd rollout restart deployment/ledger-settlement-svc -n payment-core
```

---

## 4. Post-Failover Reconciliation & Split-Brain Data Audit
Run the automated reconciliation script (`dr-recon-tool.py`) to verify that no orphaned transactions occurred during the failover transition:

```bash
python3 /opt/paysecure/scripts/reconciliation_tool.py \
    --mode audit \
    --primary-cluster paysecure-aurora-hyd \
    --dynamo-idempotency-table paysecure-idempotency-hyd \
    --time-window 15m
```
* **Audit Rules:**
  1. Any transaction present in DynamoDB with status `SUCCESS` but missing from Aurora Ledger is inserted into the `ledger_reconciliation_queue`.
  2. Any transaction marked `PROCESSING` is checked against the NPCI UPI switch via API `CheckTxn` to obtain final settlement confirmation before marking success or auto-reversing.
