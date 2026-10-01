# PaySecure Gateway Private Limited
## Disaster Recovery Runbook: DR-RB-07
# Scenario: Cross-Region Network Link Degradation & Asymmetric Partition

| Document ID | Severity Level | Target RTO | Target RPO | Authorized Roles |
| :--- | :--- | :--- | :--- | :--- |
| **DR-RB-07** | **SEV-1 (CRITICAL)** | **< 3 Minutes** | **< 1 Second** | Network Infrastructure Lead, Lead Cloud Architect |

---

## 1. Trigger Conditions
* **Trigger A:** Inter-Region Transit Gateway (TGW) peering packet loss exceeds **5%** or latency spikes from ~18ms to **> 120ms** between `ap-south-1` and `ap-south-2`.
* **Trigger B:** Aurora Global DB storage replication lag spikes rapidly (> 5,000ms) while both regional database clusters remain healthy locally.
* **Trigger C:** MSK Replicator reports connection timeouts and broken pipe exceptions between Mumbai and Hyderabad Kafka clusters.

---

## 2. Asymmetric Partition Dangers
An asymmetric network partition (where Mumbai can send to Hyderabad, but Hyderabad cannot reply, or cross-region calls stall) can cause:
1. Long-running blocked threads in application connection pools.
2. Premature and false failovers where both regions attempt to claim primary status.

---

## 3. Step-by-Step Resolution

### Step 3.1: Diagnose Transit Gateway & Peering Status
```bash
# Query TGW Peering Attachment State
aws ec2 describe-transit-gateway-peering-attachments \
    --region ap-south-1 \
    --filters Name=state,Values=available,pending,failing \
    --query 'TransitGatewayPeeringAttachments[*].[TransitGatewayAttachmentId,State,Status.Message]'
```

### Step 3.2: Engage Fallback Inter-Region VPC Peering Link
PaySecure maintains a dormant direct Inter-Region VPC Peering Connection as a cold backup to Transit Gateway:

```bash
# Update Route Tables in Mumbai Private Subnets to route 10.200.0.0/16 via VPC Peering
for RT in $(aws ec2 describe-route-tables --region ap-south-1 --filters Name=tag:Tier,Values=PrivateApp --query 'RouteTables[*].RouteTableId' --output text); do
    aws ec2 replace-route \
        --region ap-south-1 \
        --route-table-id $RT \
        --destination-cidr-block 10.200.0.0/16 \
        --vpc-peering-connection-id pcx-backup-mum-hyd-01
done

# Mirror Route Table updates in Hyderabad Private Subnets for 10.100.0.0/16
for RT in $(aws ec2 describe-route-tables --region ap-south-2 --filters Name=tag:Tier,Values=PrivateApp --query 'RouteTables[*].RouteTableId' --output text); do
    aws ec2 replace-route \
        --region ap-south-2 \
        --route-table-id $RT \
        --destination-cidr-block 10.100.0.0/16 \
        --vpc-peering-connection-id pcx-backup-mum-hyd-01
done
```

### Step 3.3: Isolate Standby Region if Network Unstable
If the inter-region backbone experiences severe flapping or degradation, sever the cross-region link to force strict regional isolation and prevent cascading thread pool starvation:
* Keep 100% traffic strictly on Mumbai (Primary).
* Temporarily pause MSK Replicator and ElastiCache Global Datastore replication until AWS backbone stabilizes.
