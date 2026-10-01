# PaySecure Gateway Private Limited
## Disaster Recovery Runbook: DR-RB-03
# Scenario: Apache Kafka Partition Loss & Consumer Rebalancing Storm

| Document ID | Severity Level | Target RTO | Target RPO | Authorized Roles |
| :--- | :--- | :--- | :--- | :--- |
| **DR-RB-03** | **SEV-2 (HIGH)** | **< 4 Minutes** | **0 Messages** | Data Platform Lead, Streaming Infrastructure Engineer |

---

## 1. Trigger Conditions
* **Trigger A:** CloudWatch Alarm `KafkaUnderReplicatedPartitions` > 0 for more than 120 seconds on `payment.txn.events` or `merchant.webhook.dispatch`.
* **Trigger B:** Consumer Group Lag on `webhook-dispatch-group` spikes beyond **50,000 unconsumed records** with consumers continuously stuck in `PreparingRebalance` state.
* **Trigger C:** Broker node disk failure or JVM OOM crash leading to leader election failure on multiple partitions.

---

## 2. Emergency Assessment & Consumer Group Freeze
1. **Identify Corrupted Partitions & Under-Replicated Partitions:**
   ```bash
   # Execute from Bastion node with MSK IAM Auth
   /opt/kafka/bin/kafka-topics.sh --bootstrap-server $MSK_BOOTSTRAP \
       --describe --under-replicated-partitions
   ```
2. **Halt Flapping Consumers to Terminate Rebalance Storm:**
   ```bash
   # Scale down offending consumer deployments temporarily to halt partition rebalancing storm
   kubectl --context=$EKS_CTX scale deployment/webhook-dispatcher-svc -n payment-streaming --replicas=0
   ```

---

## 3. Recovery & Offset Failover to Secondary Cluster

### Step 3.1: Reassign Partitions or Force Preferred Replica Election
```bash
# Force preferred leader election for all partitions
/opt/kafka/bin/kafka-leader-election.sh --bootstrap-server $MSK_BOOTSTRAP \
    --election-type PREFERRED --all-topic-partitions
```

### Step 3.2: Divert High-Priority Traffic to Hyderabad MSK Cluster
If Mumbai MSK cluster is degraded, switch producers in EKS to use the Hyderabad MSK cluster bootstrap servers:

```bash
# Update producer bootstrap server configuration in Kubernetes ConfigMap
kubectl --context=$EKS_CTX patch configmap kafka-client-config -n payment-core \
    --type merge -p '{"data":{"BOOTSTRAP_SERVERS":"b-1.paysecure-hyd-msk.xyz.c4.kafka.ap-south-2.amazonaws.com:9098,b-2.paysecure-hyd-msk.xyz.c4.kafka.ap-south-2.amazonaws.com:9098"}}'

# Rollout restart payment orchestrator pods to connect to DR MSK
kubectl --context=$EKS_CTX rollout restart deployment/payment-orchestrator-svc -n payment-core
```

### Step 3.3: Restart Consumer Groups using MSK Replicator Translated Offsets
```bash
# Restart consumers pointing to Hyderabad MSK cluster with CooperativeStickyAssignor
kubectl --context=$EKS_CTX scale deployment/webhook-dispatcher-svc -n payment-streaming --replicas=24

# Verify consumer group health
/opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server $MSK_HYD_BOOTSTRAP \
    --describe --group webhook-dispatch-group
```
