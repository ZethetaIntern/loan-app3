# PaySecure Gateway Private Limited
## Disaster Recovery Runbook: DR-RB-12
# Scenario: Post-Incident Planned Failback from Hyderabad (`ap-south-2`) to Mumbai (`ap-south-1`)

| Document ID | Severity Level | Target RTO | Target RPO | Authorized Roles |
| :--- | :--- | :--- | :--- | :--- |
| **DR-RB-12** | **PLANNED / MAINTENANCE** | **< 5 Minutes (Zero Downtime)** | **0 Data Loss** | VP of Engineering, Lead SRE, Database Architect |

---

## 1. Prerequisites & Go/No-Go Decision Gate
Failback from DR (Hyderabad) back to Primary (Mumbai) must **NEVER** be conducted in panic or under emergency pressure. It must be executed as a planned maintenance operation during low-volume hours (02:00 AM - 04:00 AM IST) after meeting all gate criteria:
1. **Gate 1:** AWS Mumbai (`ap-south-1`) has demonstrated **100% stability for at least 24 consecutive hours**.
2. **Gate 2:** Reverse replication is established: Mumbai Aurora cluster is fully rebuilt as a secondary replica of Hyderabad, and storage replication lag is **< 500ms**.
3. **Gate 3:** All Kafka topics and DynamoDB tables in Mumbai are fully synchronized with zero backlog.
4. **Gate 4:** Formal sign-off obtained from Incident Commander, CTO, and Head of Compliance.

---

## 2. Step-by-Step Failback Execution

### Step 2.1: Establish Reverse Aurora Global Replication
While Hyderabad is operating as Primary, re-attach the rebuilt Mumbai cluster as a Secondary Read Replica:

```bash
# Verify reverse replication health from Hyderabad (Source) to Mumbai (Target)
aws rds describe-global-clusters \
    --global-cluster-identifier paysecure-global-db \
    --query 'GlobalClusters[0].GlobalClusterMembers[?IsWriter==`false`].DBClusterArn'
```

### Step 2.2: Pre-Warm Mumbai EKS Compute & Cache
```bash
# Scale up Mumbai EKS deployment fleet to 100% capacity
kubectl --context=$EKS_CTX_MUM scale deployment/payment-orchestrator-svc -n payment-core --replicas=120
kubectl --context=$EKS_CTX_MUM scale deployment/upi-switch-connector-svc -n payment-core --replicas=60
kubectl --context=$EKS_CTX_MUM scale deployment/ledger-settlement-svc -n payment-core --replicas=80

# Verify pod readiness
kubectl --context=$EKS_CTX_MUM get pods -n payment-core
```

### Step 2.3: Zero-Data-Loss Planned Switchover of Aurora
Execute an orderly planned switchover (which synchronizes LSNs and guarantees zero data loss):

```bash
# Initiate planned switchover designating Mumbai as new Primary Writer
aws rds switchover-global-cluster \
    --global-cluster-identifier paysecure-global-db \
    --target-db-cluster-identifier-arn arn:aws:rds:ap-south-1:112233445566:cluster:paysecure-aurora-mumbai

# Poll status until Mumbai is verified as writer
aws rds describe-global-clusters \
    --global-cluster-identifier paysecure-global-db \
    --query 'GlobalClusters[0].GlobalClusterMembers[?IsWriter==`true`].DBClusterArn'
```

### Step 2.4: Switch Route 53 ARC Routing Controls to Mumbai
```bash
# Atomic routing flip: Mumbai ON (100%), Hyderabad OFF (0%)
aws route53-recovery-control-config update-routing-control-states \
    --routing-control-states-entries '[{"RoutingControlArn":"arn:aws:route53-recovery-control::112233445566:control/mumbai-primary-control","RoutingControlState":"On"},{"RoutingControlArn":"arn:aws:route53-recovery-control::112233445566:control/hyderabad-dr-control","RoutingControlState":"Off"}]'
```

### Step 2.5: Scale Down Hyderabad to Warm Standby (40%)
Once traffic is stably operating in Mumbai for 30 minutes with zero anomalies:
```bash
# Scale down Hyderabad EKS nodes to baseline 40% standby footprint
kubectl --context=$EKS_CTX_HYD scale deployment/payment-orchestrator-svc -n payment-core --replicas=36
kubectl --context=$EKS_CTX_HYD scale deployment/upi-switch-connector-svc -n payment-core --replicas=18
kubectl --context=$EKS_CTX_HYD scale deployment/ledger-settlement-svc -n payment-core --replicas=24
```

---

## 3. Post-Failback Post-Mortem & Reporting
1. Compile end-to-end incident timeline from initial SEV-1 trigger through failback completion.
2. Calculate total downtime, actual RPO, and actual RTO achieved.
3. Submit comprehensive Post-Incident Review (PIR) report to the Board of Directors, RBI DPSS, and partner banking networks.
