# PaySecure Gateway Private Limited
## Business Continuity Review Board (BCRB)
# Architecture Defense & Stakeholder Sign-Off Proceedings

**Session Date:** October 14, 2026  
**Project:** Multi-Region Disaster Recovery Architecture (Q3 2026 Mandate)  
**Location:** Executive Boardroom (Mumbai HQ) & Secure Telepresence  
**Board Members Present:**
1. **Rajesh Ramanathan** — Chief Technology Officer (CTO)
2. **Dr. Sunita Deshmukh** — Chief Information Security Officer (CISO)
3. **Vikramaditya Singhania** — Head of Payments & Banking Alliances
4. **Advocate Meenakshi Iyer** — Head of Regulatory Compliance & Legal Counsel
5. **Kunal Somani, FCA** — Chief Financial Officer (CFO)
**Defending Architect:** Lead Principal Disaster Recovery & Cloud Architect (Antigravity Engineering)

---

## 1. Executive Board Presentation Slide Deck

### Slide 1: The High-Stakes Imperative
* **Context:** PaySecure processes **3.2 Million daily transactions**, settling **₹500 Crore INR daily** across 45,000 enterprise and retail merchants.
* **The Vulnerability:** 100% of core transaction compute and storage currently resides in a single geographic bubble: AWS Mumbai (`ap-south-1`).
* **The Risk:** A regional failure incurs **₹3,47,222 per minute in GMV fallout**, triggers merchant smart-routing churn, breaches RBI mandates, and risks catastrophic license suspension.
* **The Mandate:** Achieve **99.99% system availability**, **RPO < 1 minute**, and **RTO < 5 minutes** by Q3 2026 within Indian sovereign borders.

### Slide 2: Architectural Solution — Hybrid Sharded Active-Active & Warm Core
* **Dual Region Topology:** Primary in AWS Mumbai (`ap-south-1`), Secondary in AWS Hyderabad (`ap-south-2`), separated by ~620 km across different seismic zones.
* **Tiered Strategy:**
  * *Ingress & Stateless APIs:* Active-Active via Route 53 ARC and CloudFront.
  * *Idempotency & Sessions:* Active-Active DynamoDB Global Tables (<150ms sync).
  * *Financial Double-Entry Ledger:* Active-Passive Aurora Global Database with sub-second physical storage replication (typical lag: 650ms).
  * *Event Sourcing:* MSK Replicator across dual Kafka clusters with deterministic offset translation.
* **Automation:** Route 53 ARC 5-region quorum control plane enables full regional traffic shift in **< 45 seconds**.

---

## 2. Transcript of the Board Defense & Cross-Examination

### Round 1: Chief Technology Officer (CTO) — Rajesh Ramanathan
> **CTO:** "Let's cut to the chase on the CAP theorem trade-off. You chose an Active-Passive model for Aurora PostgreSQL instead of a multi-master distributed SQL engine like CockroachDB or Spanner. Between Mumbai and Hyderabad, round-trip time is ~18ms. A multi-master 2-phase commit adds 50-70ms to every transaction write. But with Aurora Global Database, your storage replication is asynchronous. If Mumbai dies violently mid-transaction, how do you mathematically guarantee an RPO under 1 minute without corrupting our double-entry ledger?"

**Lead DR Architect:**
"An outstanding question, Rajesh. Our decision is grounded in payment processing reality:
1. **The Latency Constraint:** Under NPCI UPI Technical Specifications, a payment gateway has a hard timeout budget of 2,500ms before upstream UPI PSP apps (GPay, PhonePe, Paytm) abort. Adding 60ms of Raft/Paxos cross-region consensus on every ledger insert reduces our processing headroom by 30% and causes transaction drops under peak burst loads (450 TPS).
2. **Aurora Global DB Replication Mechanics:** Aurora does not use logical replication; it ships physical redo logs at the storage layer directly over the AWS inter-region backbone. Our telemetry over the last 90 days indicates mean storage lag of **420ms**, with a 99.9th percentile of **850ms**—substantially below our 1-minute regulatory ceiling.
3. **The Data Gap Protection:** When we invoke an unplanned failover (`--allow-data-loss`), the promoted Hyderabad cluster resumes from the last confirmed storage LSN. To protect against lost transactions, our edge tier records every transaction intent in **DynamoDB Global Tables** *before* hitting the ledger. Upon failover, our automated script (`dr-recon-tool.py`) reconciles DynamoDB with Aurora. If a customer was debited but the record missed Aurora's last LSN, the reconciliation tool issues an automated status query to NPCI's `UPI-REQ-CHK-TXN` and reconstructs the ledger entry idempotently. Zero double spending, zero phantom credits."

> **CTO:** *"Approved on the database tier. But what about consumer offsets in Kafka? When MSK Replicator mirrors from Mumbai to Hyderabad, how do your webhook and settlement workers know where to resume without flooding 45,000 merchants with millions of duplicate webhooks?"*

**Lead DR Architect:**
"MSK Replicator runs on Kafka Connect under the hood and translates consumer offsets between clusters into the internal topic `__amazon_msk_replicator_offsets`. However, because network mirroring is asynchronous, consumers may reprocess up to 2-3 seconds of stream history. We built **Consumer-Side Deduplication**: every outgoing webhook payload embeds an immutable signature and `webhook_event_id` in Redis and DynamoDB with a 24-hour TTL. Even if the consumer worker replays the event in Hyderabad, the dispatch worker checks Redis and skips transmission. Merchants receive exactly one webhook notification."

---

### Round 2: Chief Information Security Officer (CISO) — Dr. Sunita Deshmukh
> **CISO:** "Under PCI-DSS v4.0 Requirement 3 and the DPDP Act, encryption keys and cardholder data are my primary concern. If we replicate card tokens and credentials across Mumbai and Hyderabad, walk me through your key management. If our primary KMS key in Mumbai is compromised or if `ap-south-1` is unreachable, can Hyderabad decrypt card tokens without phone-home calls to Mumbai? And what prevents an attacker from destroying backups in both regions?"

**Lead DR Architect:**
"Dr. Deshmukh, we have engineered a zero-cross-region dependency cryptographic model:
1. **AWS KMS Multi-Region Keys (`mrk-`):** We deploy AWS KMS Multi-Region Symmetric Keys. The key in Mumbai (`ap-south-1`) and its replica in Hyderabad (`ap-south-2`) share identical key ID, key material, and rotation metadata. When Hyderabad workloads decrypt cardholder data or PAN tokens, they make local calls strictly to `kms.ap-south-2.amazonaws.com`. There is zero cross-region dependency. Even if Mumbai's entire network is annihilated, Hyderabad's cryptographic operations continue uninterrupted.
2. **Immutable Ransomware Defense (PCI-DSS Req 10):** All database transaction logs, snapshots, and audit trails are exported into a dedicated Security Account S3 bucket configured with **S3 Object Lock in Compliance Mode** with a 7-year retention period. Even our AWS Organization Root Account cannot delete or overwrite these objects before the retention expiry.
3. **Compromise Containment (Runbook DR-RB-11):** If a key is compromised, we maintain a pre-certified, dormant secondary multi-region key (`mrk-secondary`). In under 10 minutes, our tokenization engine switches to the secondary key, and a background re-encryption worker updates DynamoDB without customer checkout interruption."

---

### Round 3: Head of Payments & Banking Alliances — Vikramaditya Singhania
> **Vikramaditya:** "Our banking partners—HDFC, ICICI, State Bank of India—and NPCI have stringent uptime SLAs. In the current setup, our Direct Connect circuits terminate in Mumbai. If we fail over to Hyderabad, how do we reach NPCI and the bank host switches? If our connection drops mid-flight, do we risk leaving thousands of UPI transactions in pending status, causing customer outrage on social media?"

**Lead DR Architect:**
"Vikramaditya, our banking connectivity is dual-homed:
1. **Redundant NPCI & Bank Direct Connect Links:** We have established dual AWS Direct Connect circuits: Circuit A terminates at the Mumbai peering exchange directly into NPCI's primary data center; Circuit B terminates at the Hyderabad exchange into NPCI's secondary site.
2. **Dynamic Banking Switch Routing (Runbook DR-RB-10):** In payment aggregation, banking outages are more frequent than AWS outages. If HDFC Bank's UPI switch starts timing out (latency > 2,500ms or error rate > 15%), our smart routing engine automatically sheds load to ICICI and Axis Bank nodes in under 60 seconds.
3. **No Automatic Customer Reversals (NPCI Compliance):** When a failover occurs, any transaction in an ambiguous `PENDING` state is never marked `FAILED` arbitrarily. Runbook DR-RB-10 mandates our asynchronous auto-status poller to query NPCI's `UPI-UDIR` (Unified Dispute & Issue Resolution) clearing interface. We only confirm success or initiate an automated refund after NPCI's clearing house provides final settlement confirmation."

---

### Round 4: Head of Regulatory Compliance & Legal — Advocate Meenakshi Iyer
> **Meenakshi:** "Under the RBI Master Direction on Payment Aggregators and the April 2018 Data Localisation circular, all payment data must be stored exclusively within Indian territory. Furthermore, under Section 70B of the IT Act, CERT-In mandates cybersecurity incident reporting within 6 hours. Does this architecture guarantee 100% sovereign containment, and does your runbook satisfy regulatory reporting timelines?"

**Lead DR Architect:**
"Advocate Meenakshi, we have embedded compliance directly into the infrastructure:
1. **100% Sovereign Data Localisation:** Both AWS Mumbai (`ap-south-1`) and AWS Hyderabad (`ap-south-2`) are geographically situated inside the Republic of India. We enforce AWS Organizations Service Control Policies (SCPs) that physically deny the execution of any AWS API call, EC2 launch, or database creation in any AWS region outside India. All replication traffic traverses AWS's domestic fiber infrastructure without touching international transit routes.
2. **Seismic & Geographic Distance:** RBI Master Direction specifies that primary and DR sites must be in different seismic zones and sufficiently separated. Mumbai is in Seismic Zone III; Hyderabad is in Seismic Zone II. The aerial distance is ~620 kilometers, far exceeding the recommended 250 km threshold.
3. **Forensic Readiness & 6-Hour Reporting:** Runbooks DR-RB-01, DR-RB-09, and DR-RB-11 explicitly include step-by-step notification triggers. PagerDuty auto-populates the CERT-In incident reporting format within 60 minutes of SEV-1 declaration, well within the 6-hour statutory deadline."

---

### Round 5: Chief Financial Officer (CFO) — Kunal Somani, FCA
> **CFO:** "Now let's talk numbers. Currently, we spend ₹38.5 Lakhs a month on AWS in Mumbai. What does this multi-region architecture cost, and how do you justify this expenditure to the Board when we operate on mid-tier payment margins?"

**Lead DR Architect:**
"Kunal, here is the financial breakdown and return on investment:
1. **The Cost Analysis:** A full 1:1 active duplicate would double our bill to ₹77 Lakhs/month. Instead, we designed a **Warm Compute + Hot Data** model:
   * *Compute (EKS):* We run Hyderabad at 40% capacity during normal hours, scaling to 100% via Karpenter in 90 seconds during failover.
   * *Storage (Aurora & Redis):* Replicas run continuously in Hyderabad to guarantee sub-second RPO.
   * *Total Projected Cost:* **₹63,52,500 INR / month**, representing a **₹25.02 Lakhs/month increment (65% increase)** over baseline.
2. **The Cost of Downtime Calculus:**
   * At ₹500 Crore daily GMV, PaySecure processes **₹3,47,222 per minute**.
   * A single 2-hour regional failure puts **₹4.16 Crore in GMV directly at risk**.
   * Furthermore, enterprise merchants (contributing 60% of our GMV) have contractual SLA breach penalties of ₹50 Lakhs per incident, plus automatic volume migration to Razorpay/Cashfree.
   * Preventing **one single major regional disruption every two years** completely covers the cost of this multi-region architecture for the entire 24-month period. It is not an infrastructure expense; it is revenue and enterprise license insurance."

---

## 3. Formal Board Resolution & Unanimous Sign-Off

### Resolution BCRB-2026-04
**WHEREAS**, PaySecure Gateway Private Limited must achieve 99.99% system availability, RPO < 1 minute, and RTO < 5 minutes in compliance with RBI directives by Q3 2026;  
**WHEREAS**, the Engineering and Architecture team has submitted and rigorously defended the Multi-Region Disaster Recovery Architecture spanning AWS Mumbai (`ap-south-1`) and AWS Hyderabad (`ap-south-2`);  
**WHEREAS**, the architecture fulfills all criteria established by RBI, PCI-DSS v4.0, NPCI, and the DPDP Act 2023;  

**IT IS HEREBY RESOLVED THAT:**
1. The Multi-Region Disaster Recovery Master Architecture (`ARC-MASTER-DR-01`) is **UNANIMOUSLY APPROVED** for implementation.
2. The 12 Production Disaster Recovery Runbooks (`DR-RB-01` through `DR-RB-12`) are formally adopted as standard operating procedure.
3. The CFO is authorized to allocate the incremental monthly budget of ₹25.02 Lakhs INR for AWS Hyderabad infrastructure provisioning.
4. The Lead DR Architect shall oversee the Q1 2026 pilot deployment and execute the first bi-annual simulated failover drill prior to full production cutover in Q3 2026.

**Signatures of the Board of Review:**

* *Rajesh Ramanathan* — Chief Technology Officer [APPROVED]  
* *Dr. Sunita Deshmukh* — Chief Information Security Officer [APPROVED]  
* *Vikramaditya Singhania* — Head of Payments & Banking Alliances [APPROVED]  
* *Advocate Meenakshi Iyer* — Head of Regulatory Compliance & Legal [APPROVED]  
* *Kunal Somani, FCA* — Chief Financial Officer [APPROVED]  
