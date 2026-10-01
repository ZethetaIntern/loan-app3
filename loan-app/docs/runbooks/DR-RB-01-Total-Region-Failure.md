# PaySecure Gateway Private Limited
## Disaster Recovery Runbook: DR-RB-01
# Scenario: Total Primary Region Failure (AWS Mumbai ap-south-1 Outage)

| Document ID | Severity Level | Target RTO | Target RPO | Authorized Roles |
| :--- | :--- | :--- | :--- | :--- |
| **DR-RB-01** | **SEV-1 (CRITICAL)** | **< 5 Minutes** | **< 1 Minute** | Incident Commander (IC), Lead SRE, VP of Engineering |

---

## 1. Trigger Conditions & Assessment
* **Trigger A:** AWS Service Health Dashboard / AWS Personal Health Dashboard signals widespread service degradation across multiple Availability Zones in `ap-south-1` (EC2, RDS, Transit Gateway).
* **Trigger B:** Datadog / CloudWatch synthetic probes report **> 90% HTTP 5xx errors or connection timeouts** for 60 consecutive seconds across all edge ingress points in Mumbai.
* **Trigger C:** EKS Ingress Controller in `ap-south-1` is unreachable via internal bastion and cross-region Transit Gateway.

---

## 2. Emergency Escalation & Incident Bridge
1. **Immediate PagerDuty Escalation:** Trigger PagerDuty SEV-1 policy:
   * Paging: Incident Commander, Lead Cloud Architect, Head of Database Engineering, Core Payment Tech Lead, Head of Information Security.
2. **Open War Room:** Join `#war-room-sev1-regional-failover` Slack channel and initiate War Room Zoom bridge.
3. **Notify External Stakeholders:** Inform NPCI Network Operations Center (NOC) and Top 5 Partner Acquirer Banks (HDFC, ICICI, Axis, SBI, Kotak) of emergency regional migration.

---

## 3. Step-by-Step Failover Execution Procedure

### Step 3.1: Pre-Failover Health Check & Readiness Validation (Time: 00:00 - 00:45)
Validate that the secondary region (`ap-south-2` Hyderabad) is fully operational before executing cutover:

```bash
# Verify AWS CLI profile credentials for ap-south-2
export AWS_REGION=ap-south-2
export AWS_DEFAULT_REGION=ap-south-2

# 1. Audit Route 53 ARC Readiness Status
aws route53-recovery-readiness get-readiness-check-status \
    --readiness-check-name paysecure-hyd-readiness-check

# 2. Check Aurora Global DB replication lag
aws cloudwatch get-metric-data \
    --metric-data-queries '[{"Id":"m1","MetricStat":{"Metric":{"Namespace":"AWS/RDS","MetricName":"AuroraGlobalDBReplicationLag","Dimensions":[{"Name":"DBClusterIdentifier","Value":"paysecure-aurora-hyd"}]},"Period":60,"Stat":"Average"},"ReturnData":true}]' \
    --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
```

### Step 3.2: Promote Aurora Global Database in Hyderabad (Time: 00:45 - 02:00)
Execute emergency unplanned failover to promote `paysecure-aurora-hyd` to an independent read-write cluster:

```bash
# Execute Global Cluster Failover with data loss allowance (<1s estimated)
aws rds failover-global-cluster \
    --global-cluster-identifier paysecure-global-db \
    --target-db-cluster-identifier-arn arn:aws:rds:ap-south-2:112233445566:cluster:paysecure-aurora-hyd \
    --allow-data-loss

# Monitor cluster status until it transitions to 'available'
aws rds describe-db-clusters \
    --db-cluster-identifier paysecure-aurora-hyd \
    --query 'DBClusters[0].Status' --output text
```

### Step 3.3: Promote ElastiCache Redis in Hyderabad (Time: 02:00 - 02:40)
Promote the Hyderabad Redis cluster to become the independent write-primary:

```bash
# Disassociate Hyderabad cluster from the Global Datastore
aws elasticache remove-from-global-replication-group \
    --global-replication-group-id paysecure-global-redis \
    --global-replication-group-member-name paysecure-redis-hyd \
    --region ap-south-2

# Verify that cluster is transitioning to primary writer
aws elasticache describe-replication-groups \
    --replication-group-id paysecure-redis-hyd \
    --query 'ReplicationGroups[0].Status' --output text
```

### Step 3.4: Scale Up Amazon EKS Compute Pods in Hyderabad (Time: 02:40 - 03:20)
Trigger immediate Karpenter / HPA node autoscaling to scale from 40% warm capacity to 100% full production capacity:

```bash
# Update deployment replicas for core microservices
kubectl --context=arn:aws:eks:ap-south-2:112233445566:cluster/paysecure-eks-hyd scale deployment \
    -n payment-core \
    --replicas=120 deployment/payment-orchestrator-svc

kubectl --context=arn:aws:eks:ap-south-2:112233445566:cluster/paysecure-eks-hyd scale deployment \
    -n payment-core \
    --replicas=60 deployment/upi-switch-connector-svc

kubectl --context=arn:aws:eks:ap-south-2:112233445566:cluster/paysecure-eks-hyd scale deployment \
    -n payment-core \
    --replicas=80 deployment/ledger-settlement-svc

# Verify all pods are running and healthy
kubectl --context=arn:aws:eks:ap-south-2:112233445566:cluster/paysecure-eks-hyd get pods -n payment-core | grep -v Running
```

### Step 3.5: Execute Route 53 ARC Routing Control Cutover (Time: 03:20 - 04:00)
Flip Route 53 ARC routing controls across the 5 global control planes to divert 100% of merchant & customer ingress to Hyderabad:

```bash
# Query current ARC routing control states
aws route53-recovery-control-config get-routing-control-state \
    --routing-control-arn arn:aws:route53-recovery-control::112233445566:control/mumbai-primary-control

# Execute Atomic Two-Control Switch: Turn Mumbai OFF (0), Hyderabad ON (1)
aws route53-recovery-control-config update-routing-control-states \
    --routing-control-states-entries '[{"RoutingControlArn":"arn:aws:route53-recovery-control::112233445566:control/mumbai-primary-control","RoutingControlState":"Off"},{"RoutingControlArn":"arn:aws:route53-recovery-control::112233445566:control/hyderabad-dr-control","RoutingControlState":"On"}]'
```

---

## 4. Verification, Validation & Health Checks
1. **Edge Traffic Verification:** Run curl check against Hyderabad endpoint:
   ```bash
   curl -Iv https://api.paysecure.in/v1/health/deep
   # Expected response: HTTP/2 200 OK with header "X-PaySecure-Region: ap-south-2"
   ```
2. **Live Synthetic Transaction:** Execute an automated ₹1.00 RuPay / UPI test transaction through the live payment flow and verify end-to-end ledger write.
3. **Monitor Ingress TPS & Error Rate:** Watch Datadog dashboard `PaySecure - DR Regional Cutover`. Confirm 5xx error rate drops < 0.05% and ingress TPS matches expected baseline (~300-450 TPS).

---

## 5. Post-Failover Communications & Audit Sign-Off
1. **CERT-In Initial Notice:** Within 6 hours of SEV-1 incident declaration, submit mandatory cybersecurity incident report to CERT-In per Section 70B of IT Act.
2. **RBI Reporting:** Submit incident notification to RBI Department of Payment and Settlement Systems (DPSS) within 24 hours.
3. **Merchant Status Page:** Update `https://status.paysecure.in` confirming traffic successfully migrated to secondary region with normal processing resumed.
