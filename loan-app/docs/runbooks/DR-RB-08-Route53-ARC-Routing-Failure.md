# PaySecure Gateway Private Limited
## Disaster Recovery Runbook: DR-RB-08
# Scenario: Route 53 ARC Routing Control Failure & Global DNS Bypass

| Document ID | Severity Level | Target RTO | Target RPO | Authorized Roles |
| :--- | :--- | :--- | :--- | :--- |
| **DR-RB-08** | **SEV-1 (CRITICAL)** | **< 3 Minutes** | **N/A (Ingress Control)** | Chief Architect, Lead SRE |

---

## 1. Trigger Conditions
* **Trigger A:** AWS Route 53 ARC Control Plane API returns HTTP 500 errors or rate-limiting exceptions during an emergency failover attempt.
* **Trigger B:** DNS resolvers globally or within Indian ISPs (Jio, Airtel) fail to honor Route 53 ARC routing control updates due to rogue recursive resolver caching or TTL pinning.

---

## 2. Redundant Ingress Control Planes
Route 53 ARC provides **5 Regional Cluster Endpoints** to guarantee high availability even if standard AWS control planes fail:
1. `https://xxx.route53recoverycontrol.us-east-1.amazonaws.com`
2. `https://xxx.route53recoverycontrol.us-west-2.amazonaws.com`
3. `https://xxx.route53recoverycontrol.eu-west-1.amazonaws.com`
4. `https://xxx.route53recoverycontrol.ap-northeast-1.amazonaws.com`
5. `https://xxx.route53recoverycontrol.ap-southeast-2.amazonaws.com`

---

## 3. Emergency Bypass Procedures

### Step 3.1: Failover across ARC Cluster Endpoints
If the primary ARC endpoint does not respond within 5 seconds, cycle through the remaining 4 cluster endpoints:

```bash
# Query ARC endpoints from stored configuration
python3 -c "
import boto3
arc_client = boto3.client('route53-recovery-control-config')
cluster = arc_client.describe_cluster(ClusterArn='$ARC_CLUSTER_ARN')
for endpoint in cluster['Cluster']['ClusterEndpoints']:
    print(endpoint['Endpoint'])
"

# Force routing state change using explicit cluster endpoint
aws route53-recovery-control-config update-routing-control-states \
    --endpoint-url https://r53-arc.ap-northeast-1.amazonaws.com \
    --routing-control-states-entries '[{"RoutingControlArn":"$ARC_HYD_ARN","RoutingControlState":"On"},{"RoutingControlArn":"$ARC_MUM_ARN","RoutingControlState":"Off"}]'
```

### Step 3.2: Direct CloudFront / Global Accelerator Origin Failover
If Route 53 DNS is entirely degraded, execute an Origin Request Policy update on AWS CloudFront / AWS Global Accelerator to redirect all Anycast traffic to Hyderabad ALB:

```bash
# Update CloudFront Origin Group to set Hyderabad as Primary Origin
aws cloudfront update-distribution \
    --id $CLOUDFRONT_DISTRIBUTION_ID \
    --default-root-object index.html \
    --origin-group-id OgPaymentPrimary \
    --primary-origin-id OriginHydALB
```

### Step 3.3: Direct Merchant SDK Emergency Webhook
For Tier-1 Enterprise merchants using PaySecure SDKs:
* Dispatch an automated push via the Merchant Broadcast Channel instructing SDKs to activate local client-side fallback URL: `https://hyd-api.paysecure.in`.
