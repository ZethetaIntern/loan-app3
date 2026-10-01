# PaySecure Gateway Private Limited
## Disaster Recovery Runbook: DR-RB-09
# Scenario: Ransomware Attack, Malicious Insider or Massive Data Corruption

| Document ID | Severity Level | Target RTO | Target RPO | Authorized Roles |
| :--- | :--- | :--- | :--- | :--- |
| **DR-RB-09** | **SEV-0 (SECURITY EMERGENCY)** | **< 30 Minutes** | **< 5 Minutes (Point-in-Time)** | CISO, CTO, Incident Commander |

---

## 1. Trigger Conditions
* **Trigger A:** GuardDuty or CrowdStrike Falcon detects unauthorized privilege escalation, mass encryption/deletion of database objects, or ransomware payloads on production nodes.
* **Trigger B:** Unauthorized drop table or catastrophic data corruption detected on Aurora PostgreSQL or DynamoDB tables.
* **Trigger C:** Threat actor initiates ransom demand or compromised credentials detected executing destructive AWS API calls.

---

## 2. Emergency Containment & Isolation (Sever and Freeze)
1. **Sever All Ingress and External Access Immediately:**
   ```bash
   # Emergency Revocation of all public ALB Security Group Ingress Rules
   aws ec2 revoke-security-group-ingress \
       --region ap-south-1 \
       --group-id sg-01albpublic \
       --protocol tcp --port 443 --cidr 0.0.0.0/0
   ```
2. **Quarantine AWS IAM Credentials:**
   * Invoke emergency IAM Break-Glass procedure to revoke all active IAM role sessions across all AWS accounts.
   * Lock all API access keys and rotate root credentials.

---

## 3. Isolated Cleanroom Environment Architecture
To prevent re-infection, recovery cannot occur in the contaminated VPC:
* PaySecure maintains an **Air-Gapped Cleanroom Account & VPC (`10.250.0.0/16`)** in Hyderabad (`ap-south-2`), accessible only via hardware-MFA-enforced bastion hosts.
* **WORM Immutable Backups:** Automated daily snapshots and transaction WAL logs are pushed to an AWS S3 bucket configured with **S3 Object Lock in Compliance Mode** with retention of 7 years. These backups cannot be overwritten, encrypted, or deleted by any IAM principal, including the AWS Root Account.

---

## 4. Point-In-Time Cleanroom Restoration

### Step 4.1: Identify Clean Transaction Timestamp
Review immutable CloudTrail logs and WAL sequence records to pinpoint the exact microsecond before malicious corruption occurred (e.g., `2026-10-01T04:12:08.400Z`).

### Step 4.2: Execute Aurora Point-In-Time Restore (PITR) in Cleanroom
```bash
aws rds restore-db-cluster-to-point-in-time \
    --region ap-south-2 \
    --source-db-cluster-identifier paysecure-aurora-hyd \
    --target-db-cluster-identifier paysecure-aurora-cleanroom \
    --restore-to-time 2026-10-01T04:12:00.000Z \
    --db-subnet-group-name cleanroom-db-subnet \
    --vpc-security-group-ids sg-cleanroom-db
```

### Step 4.3: Deploy Verified Clean Application Artifacts
* Rebuild and deploy application containers strictly from signed Git release commits (verified with GPG commit signatures) stored in an isolated ECR registry.
* Verify binary checksums with cosign / Sigstore.

### Step 4.4: Regulatory Forensic Reporting
* Preserve all raw volatile memory dumps and disk snapshots for forensic submission to **CERT-In** and **RBI Cyber Security Framework** auditors.
