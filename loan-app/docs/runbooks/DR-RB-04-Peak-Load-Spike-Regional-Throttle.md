# PaySecure Gateway Private Limited
## Disaster Recovery Runbook: DR-RB-04
# Scenario: Peak-Load Spike, Regional Throttling & Traffic Spillover Failover

| Document ID | Severity Level | Target RTO | Target RPO | Authorized Roles |
| :--- | :--- | :--- | :--- | :--- |
| **DR-RB-04** | **SEV-2 (HIGH)** | **< 2 Minutes** | **0 Transactions** | Traffic Manager, Capacity Lead, Lead SRE |

---

## 1. Trigger Conditions
* **Trigger A:** Ingress TPS surges past **900 TPS** during festive sales (e.g. Diwali / Big Billion Day flash sales).
* **Trigger B:** Primary Mumbai API Gateway / ALB experiences connection queuing (`TargetResponseTime` > 1,500ms or `RejectedConnectionCount` > 0).
* **Trigger C:** AWS API Throttling or Pod CPU utilization sustains > **80%** across EKS nodes in Mumbai despite maximum HPA autoscaling.

---

## 2. Dynamic Traffic Spillover Architecture (Load Shedding & Active-Active Split)
Rather than a binary all-or-nothing failover, PaySecure engages a **Proportional Spillover** to Hyderabad:
* Route 53 ARC Routing Controls allow fractional routing or weighted shifts (e.g., 50% Mumbai, 50% Hyderabad).
* Hyderabad EKS cluster handles checkout session initialization and card tokenization, forwarding core DB transactions to Aurora or processing read-only queries locally.

---

## 3. Execution Steps

### Step 3.1: Pre-Warm Hyderabad Fleet
```bash
# Instantly scale Hyderabad EKS nodes via Karpenter NodePool provisioner
kubectl --context=$EKS_CTX_HYD apply -f - <<EOF
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: peak-traffic-pool
spec:
  template:
    spec:
      requirements:
        - key: "karpenter.k8s.aws/instance-type"
          operator: In
          values: ["c6i.4xlarge", "c6i.8xlarge"]
        - key: "karpenter.sh/capacity-type"
          operator: In
          values: ["on-demand"]
  limits:
    cpu: 500
EOF

# Pre-scale Ingress and Payment Orchestrators in Hyderabad
kubectl --context=$EKS_CTX_HYD scale deployment/payment-orchestrator-svc -n payment-core --replicas=90
```

### Step 3.2: Rebalance Edge Traffic via Route 53 Weighted Records
```bash
# Shift 40% of merchant API ingress to Hyderabad ALB via Route 53
aws route53 change-resource-record-sets \
    --hosted-zone-id Z1PAYSECUREZONE \
    --change-batch '{
      "Changes": [
        {
          "Action": "UPSERT",
          "ResourceRecordSet": {
            "Name": "api.paysecure.in",
            "Type": "A",
            "SetIdentifier": "Mumbai-Primary-Weighted",
            "Weight": 60,
            "AliasTarget": {
              "HostedZoneId": "Z1LVMABB99",
              "DNSName": "dualstack.paysecure-mum-alb.ap-south-1.elb.amazonaws.com",
              "EvaluateTargetHealth": true
            }
          }
        },
        {
          "Action": "UPSERT",
          "ResourceRecordSet": {
            "Name": "api.paysecure.in",
            "Type": "A",
            "SetIdentifier": "Hyderabad-Spillover-Weighted",
            "Weight": 40,
            "AliasTarget": {
              "HostedZoneId": "Z2LVMABB88",
              "DNSName": "dualstack.paysecure-hyd-alb.ap-south-2.elb.amazonaws.com",
              "EvaluateTargetHealth": true
            }
          }
        }
      ]
    }'
```

### Step 3.3: Activate Rate Limiting & Prioritization Filter
If downstream banking partner nodes (HDFC, ICICI, SBI) begin rejecting transactions with HTTP 429:
* Activate Tiered QoS: Protect enterprise merchants (Tier 1) and throttle non-critical merchant webhooks and report generation.
```bash
kubectl --context=$EKS_CTX_MUM set env deployment/ingress-gateway-svc \
    -n payment-ingress ENABLE_TIERED_THROTTLING=true LOW_PRIORITY_RATE_LIMIT=50
```
