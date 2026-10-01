# PaySecure Gateway Private Limited
## Disaster Recovery Runbook: DR-RB-11
# Scenario: Multi-Region KMS Key Compromise & Cardholder Decryption Failure

| Document ID | Severity Level | Target RTO | Target RPO | Authorized Roles |
| :--- | :--- | :--- | :--- | :--- |
| **DR-RB-11** | **SEV-0 (SECURITY EMERGENCY)** | **< 10 Minutes** | **0 Compromised Records** | CISO, Cryptographic Officer, Security Architect |

---

## 1. Trigger Conditions
* **Trigger A:** AWS CloudTrail alerts on unauthorized or abnormal `kms:Decrypt` calls originating from unapproved IP ranges or unrecognized IAM entities.
* **Trigger B:** Application services throw widespread `KMS.InvalidCiphertextException` or `KMS.AccessDeniedException` across `ap-south-1` or `ap-south-2`.
* **Trigger C:** Cryptographic Officer issues notice that the active multi-region data encryption key (`mrk-`) has been potentially leaked or compromised.

---

## 2. Emergency Containment & Key Quarantine
1. **Disable Compromised Multi-Region Key Immediately:**
   ```bash
   # Disable primary key in ap-south-1 (Disabling primary does not automatically disable replica)
   aws kms disable-key \
       --region ap-south-1 \
       --key-id arn:aws:kms:ap-south-1:112233445566:key/mrk-847291a0c4f84d6fb30b

   # Disable replica key in ap-south-2
   aws kms disable-key \
       --region ap-south-2 \
       --key-id arn:aws:kms:ap-south-2:112233445566:key/mrk-847291a0c4f84d6fb30b
   ```

---

## 3. Emergency Key Cutover & Envelope Re-Encryption

### Step 3.1: Activate Standby Multi-Region Key (`mrk-secondary`)
PaySecure maintains a pre-provisioned, pre-certified dormant secondary Multi-Region Key in both regions:

```bash
# Enable pre-provisioned secondary key
aws kms enable-key \
    --region ap-south-1 \
    --key-id arn:aws:kms:ap-south-1:112233445566:key/mrk-secondary-99a1b2c3d4e5

aws kms enable-key \
    --region ap-south-2 \
    --key-id arn:aws:kms:ap-south-2:112233445566:key/mrk-secondary-99a1b2c3d4e5
```

### Step 3.2: Update Microservices Key Configuration
```bash
# Push new key ARN into Kubernetes Secrets across both clusters
kubectl --context=$EKS_CTX_HYD patch secret payment-crypto-keys -n payment-core \
    --type merge -p '{"data":{"ACTIVE_KMS_KEY_ARN":"'"$(echo -n 'arn:aws:kms:ap-south-2:112233445566:key/mrk-secondary-99a1b2c3d4e5' | base64)"'"}}'

# Perform rolling restart of Tokenization Engine
kubectl --context=$EKS_CTX_HYD rollout restart deployment/token-vault-svc -n payment-core
```

### Step 3.3: Background Asynchronous Envelope Re-Encryption
To re-encrypt existing cardholder tokens with the new key without locking production tables:
* Launch asynchronous token migrator: reads ciphertexts, invokes `kms:ReEncrypt` against AWS KMS, and atomically updates the DynamoDB Token Vault.
* PCI-DSS v4.0 Requirement 3.6/3.7 compliance report is automatically compiled for Qualified Security Assessor (QSA).
