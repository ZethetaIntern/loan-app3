# PaySecure Gateway Private Limited
## Disaster Recovery Runbook: DR-RB-10
# Scenario: UPI Switch, NPCI Network Gateway or Bank Node Outage

| Document ID | Severity Level | Target RTO | Target RPO | Authorized Roles |
| :--- | :--- | :--- | :--- | :--- |
| **DR-RB-10** | **SEV-1 (CRITICAL)** | **< 60 Seconds** | **0 Transactions** | Head of Banking Alliances, UPI Platform Lead |

---

## 1. Trigger Conditions
* **Trigger A:** NPCI UPI Switch connection latency exceeds **2,500ms** or drops TCP handshake over the dedicated MPLS / AWS Direct Connect link.
* **Trigger B:** Major partner PSP Acquirer Bank (e.g. HDFC or ICICI Bank UPI Node) returns error code `U19` (Reserved / Timeout) or `U30` (Debited but not confirmed) for **> 15% of transactions** over a 2-minute rolling window.
* **Trigger C:** NPCI issues an emergency broadcast circular regarding national switch maintenance or node-level degradation.

---

## 2. Multi-Acquirer Smart Dynamic Routing Architecture
PaySecure does not depend on a single banking rail. PaySecure integrates with **3 Acquirer Bank UPI Switches** (HDFC, ICICI, Axis) and maintains redundant Direct Connect circuits:
* Link A: Primary NPCI Direct Connect in Mumbai.
* Link B: Secondary NPCI Direct Connect in Hyderabad.

---

## 3. Dynamic Rerouting & De-Risking Procedure

### Step 3.1: Verify Dynamic Multi-Bank Health Metrics
```bash
# Query the live banking node success rate endpoint
curl -s http://localhost:8080/internal/v1/bank-health-metrics | jq '.banks[] | {bank: .name, success_rate: .sr_1m, p99_latency: .p99}'
```

### Step 3.2: Execute Dynamic Traffic Shedding & Bank Switch
If HDFC UPI node SR drops below 75%, immediately divert 100% of UPI collect and intent traffic to ICICI and Axis Bank nodes:

```bash
# Update Dynamic Routing Matrix via Admin API
curl -X POST http://localhost:8080/internal/v1/routing-engine/override \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "channel": "UPI",
      "allocations": {
        "HDFC": 0,
        "ICICI": 60,
        "AXIS": 40
      },
      "reason": "HDFC_NODE_TIMEOUT_SEV1"
    }'
```

### Step 3.3: Handle Transactions in Pending/In-Flight State
1. Do **NOT** fail transactions immediately if bank callback times out; NPCI guidelines prohibit declaring failure when customer account might have been debited.
2. Push all in-flight transaction IDs to Kafka topic `upi.auto.status.check`.
3. The Auto-Reconciliation worker polls NPCI `UPI-REQ-CHK-TXN` at exponential intervals ($T+30s$, $T+60s$, $T+120s$, $T+300s$) to fetch definitive debit/credit confirmation before resolving status.
