import React, { useState, useEffect } from 'react';
import {
  Shield, Server, Database, Activity, AlertTriangle, CheckCircle2,
  RefreshCw, Zap, FileText, Terminal, ArrowRight, Lock, Scale,
  Users, Check, ExternalLink, Layers, Globe, Radio, Play, ChevronRight,
  TrendingUp, Clock, HardDrive, Cpu, AlertCircle, ArrowUpRight, Copy
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('architecture');
  const [activeRegion, setActiveRegion] = useState('ap-south-1'); // 'ap-south-1' (Mumbai) or 'ap-south-2' (Hyderabad)
  const [isSimulatingFailover, setIsSimulatingFailover] = useState(false);
  const [failoverStep, setFailoverStep] = useState(0);
  const [selectedRunbookId, setSelectedRunbookId] = useState('DR-RB-01');
  const [runbookExecuting, setRunbookExecuting] = useState(false);
  const [runbookLogs, setRunbookLogs] = useState([]);
  const [selectedComplianceFilter, setSelectedComplianceFilter] = useState('ALL');
  const [activeStakeholder, setActiveStakeholder] = useState('CTO');
  const [activeTool, setActiveTool] = useState('orchestrator');
  const [scriptOutput, setScriptOutput] = useState(null);
  const [scriptRunning, setScriptRunning] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Telemetry metrics
  const [auroraLag, setAuroraLag] = useState(420);
  const [ddbSync, setDdbSync] = useState(115);
  const [redisSync, setRedisSync] = useState(185);
  const [kafkaLag, setKafkaLag] = useState(12);
  const [currentTps, setCurrentTps] = useState(384);

  // Fluctuate telemetry slightly to make it feel alive
  useEffect(() => {
    const interval = setInterval(() => {
      setAuroraLag((prev) => Math.max(310, Math.min(650, prev + Math.floor(Math.random() * 41) - 20)));
      setDdbSync((prev) => Math.max(85, Math.min(160, prev + Math.floor(Math.random() * 21) - 10)));
      setRedisSync((prev) => Math.max(140, Math.min(240, prev + Math.floor(Math.random() * 21) - 10)));
      setCurrentTps((prev) => Math.max(340, Math.min(460, prev + Math.floor(Math.random() * 15) - 7)));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Runbook Definitions
  const runbooks = [
    {
      id: 'DR-RB-01',
      title: 'Total Region Failure (Mumbai Catastrophic Loss)',
      sev: 'SEV-1',
      rto: '< 3 mins',
      rpo: '< 1 sec',
      trigger: '3+ AZs offline or Route 53 ARC 503 error rate > 40%',
      summary: 'Automated failover of entire payment gateway traffic from Mumbai to Hyderabad DR region.',
      steps: [
        'Confirm regional loss via Route 53 ARC 5-region consensus control plane',
        'Promote Aurora PostgreSQL Global Database in ap-south-2 (unplanned failover)',
        'Scale EKS Karpenter compute pool in ap-south-2 from 40% to 100% capacity',
        'Toggle Route 53 ARC Routing Controls to route 100% ingress to Hyderabad',
        'Trigger automated post-failover financial reconciliation engine'
      ]
    },
    {
      id: 'DR-RB-02',
      title: 'Aurora Database Failover & Split-Brain Mitigation',
      sev: 'SEV-1',
      rto: '< 90 secs',
      rpo: '< 1 sec',
      trigger: 'Primary Aurora Writer unreachable for 30s or storage isolation',
      summary: 'Promote Hyderabad secondary cluster and sever replication to eliminate dual-writer divergence.',
      steps: [
        'Execute rds:FailoverGlobalCluster pointing to ap-south-2 cluster ARN',
        'Enforce application DB connection re-routing to Hyderabad endpoint',
        'Verify zero split-brain via Route 53 ARC safety rules',
        'Validate sequence ID continuity using distributed Snowflake generator'
      ]
    },
    {
      id: 'DR-RB-03',
      title: 'Kafka Partition Loss & Consumer Rebalancing',
      sev: 'SEV-2',
      rto: '< 2 mins',
      rpo: '< 500ms',
      trigger: 'Under-replicated partitions > 5 or consumer lag > 50,000 msgs',
      summary: 'Switch MSK consumer groups to Hyderabad mirror cluster with offset translation.',
      steps: [
        'Isolate degraded MSK broker in Mumbai cluster',
        'Activate MSK Replicator consumer group offset translation',
        'Redirect payment event workers to Hyderabad bootstrap servers',
        'Execute consumer-side idempotency deduplication checks'
      ]
    },
    {
      id: 'DR-RB-04',
      title: 'Peak Load Festival Spike & Regional Throttling',
      sev: 'SEV-2',
      rto: 'Immediate',
      rpo: '0 secs',
      trigger: 'TPS surge > 800 TPS (Diwali / Big Billion Day flash sale)',
      summary: 'Dynamic split-traffic balancing and non-critical webhook rate-limiting.',
      steps: [
        'Activate Route 53 ARC multi-region weighted routing (60% Mum / 40% Hyd)',
        'Autoscale DynamoDB on-demand throughput limits',
        'Throttle non-essential merchant analytics & report exports',
        'Engage ElastiCache cluster Redis read-replicas for BIN lookup caching'
      ]
    },
    {
      id: 'DR-RB-05',
      title: 'DynamoDB Global Table Replication Desynchronization',
      sev: 'SEV-2',
      rto: '< 5 mins',
      rpo: '< 200ms',
      trigger: 'ReplicationLatency metric > 2,000ms for 3 consecutive intervals',
      summary: 'Detect and resolve cross-region item conflicts and idempotency desync.',
      steps: [
        'Isolate region experiencing write throttle using CloudWatch telemetry',
        'Switch client tokenization reads to local strong-consistency mode',
        'Invoke DynamoDB point-in-time recovery for affected partition keys',
        'Verify transaction idempotency deduplication across both regions'
      ]
    },
    {
      id: 'DR-RB-06',
      title: 'Redis Cluster Outage & Cache Stampede Mitigation',
      sev: 'SEV-2',
      rto: '< 60 secs',
      rpo: '< 1 sec',
      trigger: 'Redis cluster failover event or cache hit ratio dropping below 80%',
      summary: 'Promote ElastiCache Redis Global Datastore secondary replica to standalone primary.',
      steps: [
        'Promote ap-south-2 secondary cluster to primary replication group',
        'Enable probabilistic cache early-expiration to prevent database stampede',
        'Pre-warm BIN routing and merchant configuration caches',
        'Direct application connection pool to new configuration endpoint'
      ]
    },
    {
      id: 'DR-RB-07',
      title: 'Cross-Region Network Partition & Split-Brain Avoidance',
      sev: 'SEV-1',
      rto: '< 2 mins',
      rpo: '0 secs',
      trigger: 'TGW Inter-region peering packet loss > 50% or heartbeat failure',
      summary: 'Assert quorum via Route 53 ARC safety rules to prevent dual-primary divergence.',
      steps: [
        'Evaluate Route 53 ARC assertion rule: ensure exactly one region writes to ledger',
        'Downgrade secondary region to read-only ingress forwarding',
        'Queue cross-region settlement events in local MSK buffer',
        'Monitor AWS Health Dashboard for inter-region transit backbone status'
      ]
    },
    {
      id: 'DR-RB-08',
      title: 'Route 53 ARC Routing Control Failure & DNS Fallback',
      sev: 'SEV-1',
      rto: '< 45 secs',
      rpo: '0 secs',
      trigger: 'ARC API endpoint degradation across 2+ AWS regions',
      summary: 'Fallback to CloudFront origin failover and manual Route 53 alias record override.',
      steps: [
        'Engage CloudFront Origin Group automated failover to Hyderabad ALB',
        'Execute emergency AWS CLI DNS alias update with 10s TTL',
        'Verify edge ISP DNS propagation across major Indian telcos (Jio, Airtel)',
        'Confirm payment traffic recovery on Hyderabad ingress ALBs'
      ]
    },
    {
      id: 'DR-RB-09',
      title: 'Ransomware & Data Corruption Cleanroom Recovery',
      sev: 'SEV-1',
      rto: '< 4 hours',
      rpo: '< 15 mins',
      trigger: 'Cryptographic anomaly detected in database or unauthorized schema drop',
      summary: 'Restore from S3 Object Lock WORM immutable backups into isolated Cleanroom VPC.',
      steps: [
        'Immediately quarantine production VPCs and revoke all IAM session tokens',
        'Spin up isolated Cleanroom VPC in ap-south-2 (Hyderabad)',
        'Restore Aurora DB from S3 Object Lock Compliance WORM snapshot',
        'Execute automated ledger integrity scanner to identify corruption timestamp',
        'Perform point-in-time recovery (PITR) to exact microsecond before compromise'
      ]
    },
    {
      id: 'DR-RB-10',
      title: 'UPI Switch & NPCI / Acquiring Bank Node Failure',
      sev: 'SEV-2',
      rto: '< 60 secs',
      rpo: '0 secs',
      trigger: 'Bank UPI node timeout rate > 15% (e.g. HDFC or ICICI PSP timeout)',
      summary: 'Smart routing traffic away from degraded bank switch; prevent auto-failing UPI txns.',
      steps: [
        'Trigger PaySecure Smart Routing engine to re-route 100% traffic to healthy bank nodes',
        'Divert timed-out UPI transactions to Kafka auto-status queue',
        'Poll NPCI UPI-UDIR and ReqChkTxn clearing endpoints at T+30s, 60s, 120s',
        'Guarantee zero customer double-debit without final settlement confirmation'
      ]
    },
    {
      id: 'DR-RB-11',
      title: 'KMS Multi-Region Key Compromise & Decryption Failure',
      sev: 'SEV-1',
      rto: '< 10 mins',
      rpo: '0 secs',
      trigger: 'Security alert: anomalous KMS Decrypt volume or compromise advisory',
      summary: 'Switch token store encryption to secondary pre-certified multi-region key.',
      steps: [
        'Disable compromised primary KMS multi-region key policy',
        'Activate pre-staged secondary multi-region key (mrk-secondary)',
        'Update EKS Secrets Store CSI driver with new key ARN',
        'Initiate background re-encryption worker for active cardholder token vault'
      ]
    },
    {
      id: 'DR-RB-12',
      title: 'Post-Incident Controlled Failback to Mumbai Primary',
      sev: 'SEV-2',
      rto: '< 5 mins',
      rpo: '0 secs',
      trigger: 'Mumbai region verified 100% stable for at least 4 continuous hours',
      summary: 'Reverse replication stream, synchronize delta LSN, and smoothly return traffic to Mumbai.',
      steps: [
        'Verify Mumbai Aurora DB is re-enrolled as secondary replica of Hyderabad',
        'Ensure Aurora Global DB replication lag from Hyderabad to Mumbai is < 500ms',
        'Synchronize MSK consumer offsets between Hyderabad and Mumbai',
        'Perform planned Route 53 ARC switchover during low-traffic window',
        'Issue regulatory post-mortem notice to RBI and CERT-In within 24 hours'
      ]
    }
  ];

  // Regulatory Compliance Items
  const complianceData = [
    {
      authority: 'RBI',
      clause: 'Section 8.1 & 8.2 (PA/PG Master Direction)',
      mandate: 'Mandatory Board-approved Business Continuity Plan; Geographic separation of Primary and DR sites; Bi-annual DR mock drills.',
      implementation: 'Primary in Mumbai (ap-south-1), DR in Hyderabad (ap-south-2). Distance ~620 km across distinct seismic zones (Zone III vs Zone II). Bi-annual automated drills scheduled in Q1 and Q3.',
      verification: 'CloudTrail drill audit logs, Board approval resolution, AWS architectural blueprints.'
    },
    {
      authority: 'RBI',
      clause: 'Section 8.3 (PA/PG Master Direction)',
      mandate: 'Aggregator must achieve RPO and RTO that minimizes systemic risk and customer transaction loss.',
      implementation: 'Target RTO < 5 mins (Achieved < 3 mins via Route 53 ARC); Target RPO < 1 min (Achieved < 1 sec via Aurora Global DB physical storage replication).',
      verification: 'Real-time CloudWatch RPO/RTO dashboards, AWS FIS Chaos experiment reports.'
    },
    {
      authority: 'RBI Data Localisation',
      clause: 'DPSS Circular (April 6, 2018)',
      mandate: 'Entire payment data relating to payment systems operated in India must be stored exclusively in systems located in India.',
      implementation: 'Both Mumbai and Hyderabad regions are inside the Republic of India. AWS SCPs strictly block any AWS resource creation in regions outside India.',
      verification: 'AWS Organizations SCP JSON policy exports, VPC routing table dumps.'
    },
    {
      authority: 'PCI-DSS v4.0',
      clause: 'Requirement 3.5, 3.6, 3.7',
      mandate: 'Protect cardholder data with strong cryptographic key management; zero cross-border key dependencies.',
      implementation: 'Dual-region AWS KMS Multi-Region Keys (mrk-) with automated rotation. Hyderabad decrypts tokens locally without calling Mumbai.',
      verification: 'KMS Key Policy audits, CloudTrail kms:Decrypt access logs, QSA ROC.'
    },
    {
      authority: 'PCI-DSS v4.0',
      clause: 'Requirement 9.5 & 10.2, 10.3',
      mandate: 'Maintain physical/logical security of backups; automated audit trails for critical access; WORM retention.',
      implementation: 'Database snapshots and audit logs written to S3 buckets configured with S3 Object Lock in Compliance Mode (7-year WORM retention).',
      verification: 'S3 Object Lock configuration dumps, SHA-256 verification hashes.'
    },
    {
      authority: 'NPCI UPI',
      clause: 'Section 4.3 & 7.2',
      mandate: 'Prevent duplicate processing (idempotency); no auto-failing timed-out UPI transactions without clearing confirmation.',
      implementation: 'DynamoDB Global Tables enforce conditional idempotency writes. Timed-out txns poll NPCI UPI-UDIR clearing house before debiting or refunding.',
      verification: 'Zero duplicate debit customer grievance logs, NPCI clearing settlement reports.'
    },
    {
      authority: 'DPDP Act 2023',
      clause: 'Section 8(5) & 8(6)',
      mandate: 'Data Fiduciary must implement reasonable security safeguards and report data breaches within statutory deadlines.',
      implementation: 'Customer PII encrypted at rest using AES-256-GCM. Isolated Cleanroom VPC allows forensic audits. Automated 6-hour CERT-In incident notification trigger.',
      verification: 'Cleanroom access logs, Data Protection Impact Assessment (DPIA).'
    }
  ];

  // BCRB Stakeholders
  const stakeholders = {
    CTO: {
      name: 'Rajesh Ramanathan',
      role: 'Chief Technology Officer',
      question: 'Why Active-Passive for Aurora PostgreSQL instead of multi-master distributed SQL across Mumbai and Hyderabad?',
      answer: 'NPCI UPI specifications impose a strict 2,500ms transaction timeout budget. Inter-region round-trip time between Mumbai and Hyderabad is ~18ms. Distributed 2-phase commit (2PC) or Paxos consensus across regions adds 50-70ms to every transaction write, slashing peak throughput by 30% and risking timeouts during flash sales. Aurora Global DB uses asynchronous physical storage redo-log streaming directly over the AWS backbone, yielding an actual replication lag of 420ms (substantially below our 60s RPO). Pre-ledger DynamoDB idempotency logging ensures zero transaction loss upon failover.'
    },
    CISO: {
      name: 'Dr. Sunita Deshmukh',
      role: 'Chief Information Security Officer',
      question: 'Under PCI-DSS v4.0 Requirement 3, how do you prevent cross-region decryption dependencies and defend against ransomware?',
      answer: 'We utilize AWS KMS Multi-Region Keys (MRKs). The key in Mumbai and its replica in Hyderabad share identical key material and key IDs. When Hyderabad workloads decrypt cardholder tokens, they query kms.ap-south-2.amazonaws.com directly—zero cross-region network dependency. For ransomware defense, all database snapshots, transaction WALs, and audit logs are continuously mirrored to an isolated Security Account S3 bucket configured with S3 Object Lock in Compliance Mode (7-year WORM retention), rendering backups immutable even against root account compromise.'
    },
    Banking: {
      name: 'Vikramaditya Singhania',
      role: 'Head of Payments & Banking Alliances',
      question: 'How does the architecture maintain connectivity with NPCI and bank switches (HDFC, ICICI, SBI) during regional failure?',
      answer: 'We have dual Direct Connect circuits: Circuit A terminates at Mumbai Direct Connect into NPCI primary; Circuit B terminates at Hyderabad Direct Connect into NPCI secondary. Under Runbook DR-RB-10, our Smart Routing engine monitors partner bank error codes in real-time. If HDFC Bank times out (>15% errors), traffic shifts automatically to ICICI and Axis Bank nodes in under 60 seconds. Any in-flight transaction is never arbitrarily failed; our reconciler queries NPCI UPI-UDIR to confirm clearing before taking ledger action.'
    },
    Legal: {
      name: 'Advocate Meenakshi Iyer',
      role: 'Head of Regulatory Compliance & Legal Counsel',
      question: 'Does this architecture satisfy 100% Indian sovereign data localisation and CERT-In 6-hour incident reporting rules?',
      answer: 'Yes, 100%. Both AWS Mumbai (ap-south-1) and AWS Hyderabad (ap-south-2) are within Indian sovereign territory. We enforce AWS Organizations Service Control Policies (SCPs) that physically deny any AWS API calls in regions outside India. Inter-region replication traverses AWS’s domestic backbone without touching international cables. Additionally, our automated incident response system auto-generates CERT-In Annexure incident reports within 60 minutes of SEV-1 declaration, well ahead of the 6-hour statutory window.'
    },
    CFO: {
      name: 'Kunal Somani, FCA',
      role: 'Chief Financial Officer',
      question: 'What is the total incremental infrastructure cost of this multi-region architecture, and what is the return on investment?',
      answer: 'A pure 1:1 active duplicate would double our costs to ₹77 Lakhs/month. Instead, we designed a Warm Compute + Hot Data model. Compute runs at 40% in Hyderabad during normal hours and auto-expands via Karpenter in 90 seconds. Total monthly infrastructure spend is ₹63,52,500 INR, representing an incremental cost of ₹25.02 Lakhs/month (65% increase). PaySecure processes ₹3,47,222 per minute in GMV. Preventing a single 2-hour regional outage saves ₹4.16 Crore in direct GMV fallout, avoids ₹50 Lakhs in enterprise SLA penalties, and shields against RBI fines up to ₹5 Crore.'
    }
  };

  // Runbook Simulation Executor
  const handleExecuteRunbook = (rb) => {
    setRunbookExecuting(true);
    setRunbookLogs([]);
    const logs = [];

    const addLog = (msg, delay) => {
      setTimeout(() => {
        logs.push({ timestamp: new Date().toISOString().split('T')[1].slice(0, 8), message: msg });
        setRunbookLogs([...logs]);
      }, delay);
    };

    addLog(`[INIT] Incident Commander dispatched ${rb.id}: ${rb.title}`, 200);
    addLog(`[TELEMETRY] Evaluating trigger condition: "${rb.trigger}"`, 800);
    addLog(`[TARGETS] Target RTO: ${rb.rto} | Target RPO: ${rb.rpo}`, 1400);

    rb.steps.forEach((step, index) => {
      addLog(`[STEP ${index + 1}/${rb.steps.length}] ${step}`, 2000 + index * 900);
    });

    setTimeout(() => {
      addLog(`[VERIFY] Health checks deep-ping: HTTP 200 OK across all ingress nodes`, 2000 + rb.steps.length * 900 + 400);
      addLog(`[SUCCESS] Runbook ${rb.id} executed successfully. RTO: 2.8s (Target: ${rb.rto}) | RPO: < 1s (Target: ${rb.rpo}). Regulatory SLA PASSED.`, 2000 + rb.steps.length * 900 + 1000);
      setRunbookExecuting(false);
    }, 2000 + rb.steps.length * 900 + 1200);
  };

  // Full Failover Simulation
  const handleTriggerFullFailover = () => {
    setIsSimulatingFailover(true);
    setFailoverStep(1);

    setTimeout(() => setFailoverStep(2), 1200);
    setTimeout(() => setFailoverStep(3), 2600);
    setTimeout(() => setFailoverStep(4), 4000);
    setTimeout(() => {
      setActiveRegion(activeRegion === 'ap-south-1' ? 'ap-south-2' : 'ap-south-1');
      setIsSimulatingFailover(false);
      setFailoverStep(0);
    }, 5500);
  };

  // Script Runner Simulation
  const handleRunScript = (toolType) => {
    setScriptRunning(true);
    setScriptOutput(null);
    setTimeout(() => {
      if (toolType === 'orchestrator') {
        setScriptOutput({
          status: 'SUCCESS',
          primary_region: 'ap-south-1',
          dr_region: 'ap-south-2',
          pre_flight_checks: {
            aurora_replication_lag_ms: auroraLag,
            arc_routing_control_readiness: 'HEALTHY',
            hyderabad_karpenter_fleet: 'ARMED (160 vCPU provisioned)'
          },
          actions_executed: [
            'rds:FailoverGlobalCluster(paysecure-global-db, allow_data_loss=true)',
            'eks:ScaleDeployment(payment-orchestrator: 120 replicas, ledger-engine: 80 replicas)',
            'route53-recovery-control:UpdateRoutingControlStates(Mumbai: OFF, Hyderabad: ON)'
          ],
          total_rto_seconds: 3.30,
          estimated_rpo_seconds: (auroraLag / 1000).toFixed(2),
          regulatory_sla_met: true
        });
      } else {
        setScriptOutput({
          total_transactions_inspected: 3,
          clean_synced_ledger_entries: 1,
          reconstructed_ledger_entries: 2,
          disputed_or_reversed_entries: 0,
          financial_integrity_status: '100% RECONCILED',
          double_spending_events: 0,
          phantom_credits: 0,
          npci_clearing_status_checks: [
            { txn_id: 'TXN_998101', rrn: '428190182711', status: 'IN_SYNC' },
            { txn_id: 'TXN_998102', rrn: '428190182712', status: 'RECONSTRUCTED_CONFIRMED' },
            { txn_id: 'TXN_998103', rrn: '428190182713', status: 'RECONSTRUCTED_CONFIRMED' }
          ]
        });
      }
      setScriptRunning(false);
    }, 1500);
  };

  const selectedRunbook = runbooks.find((r) => r.id === selectedRunbookId) || runbooks[0];

  const filteredCompliance = selectedComplianceFilter === 'ALL'
    ? complianceData
    : complianceData.filter((c) => c.authority.toUpperCase().includes(selectedComplianceFilter));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Banner / Regulatory Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  PaySecure Gateway
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  BFSI Aggregator
                </span>
                <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  v3.4 Production DR
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>Regulatory SLA Target: 99.99% Uptime</span>
                <span>•</span>
                <span>RPO &lt; 1 min</span>
                <span>•</span>
                <span>RTO &lt; 5 mins</span>
                <span>•</span>
                <span className="text-emerald-400 font-medium">100% Indian Sovereign Data Localisation</span>
              </p>
            </div>
          </div>

          {/* Region Switcher & Live Health Badge */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-subtle"></span>
                <span className="font-mono text-slate-300">
                  ACTIVE: <span className="font-bold text-emerald-400">{activeRegion === 'ap-south-1' ? 'Mumbai (ap-south-1)' : 'Hyderabad (ap-south-2)'}</span>
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="font-mono text-slate-400">
                STANDBY: <span className="text-slate-300">{activeRegion === 'ap-south-1' ? 'Hyderabad (ap-south-2)' : 'Mumbai (ap-south-1)'}</span>
              </div>
            </div>

            <button
              onClick={handleTriggerFullFailover}
              disabled={isSimulatingFailover}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 shadow-md shadow-orange-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSimulatingFailover ? 'animate-spin' : ''}`} />
              <span>{isSimulatingFailover ? 'Failing Over...' : 'Simulate ARC Regional Cutover'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Failover In-Flight Progress Modal */}
      {isSimulatingFailover && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 animate-bounce text-amber-400" />
              <span className="font-semibold">EMERGENCY REGIONAL CUTOVER IN PROGRESS:</span>
              <span className="font-mono">
                {failoverStep === 1 && 'Step 1/4: Pre-flight telemetry check & Aurora Global DB promotion...'}
                {failoverStep === 2 && 'Step 2/4: Karpenter auto-scaling Hyderabad EKS node fleet (40% to 100%)...'}
                {failoverStep === 3 && 'Step 3/4: Route 53 ARC toggling routing controls (Mumbai OFF, Hyderabad ON)...'}
                {failoverStep === 4 && 'Step 4/4: Re-routing edge Anycast ingress and verifying 200 OK deep-health...'}
              </span>
            </div>
            <div className="font-mono text-xs bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
              Live RTO Elapsed: ~{(failoverStep * 0.8).toFixed(1)}s (Target: &lt; 300s)
            </div>
          </div>
        </div>
      )}

      {/* KPI Ticker Bar */}
      <div className="bg-slate-900/50 border-b border-slate-800/80 px-6 py-2 text-xs">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-6 gap-4 text-slate-400">
          <div>
            <span className="text-slate-500 block">Daily Volume</span>
            <span className="font-mono font-semibold text-slate-200">3.2M Txns/day</span>
          </div>
          <div>
            <span className="text-slate-500 block">Daily GMV</span>
            <span className="font-mono font-semibold text-emerald-400">₹500 Crore / day</span>
          </div>
          <div>
            <span className="text-slate-500 block">Active Merchants</span>
            <span className="font-mono font-semibold text-slate-200">45,000+ Enterprises</span>
          </div>
          <div>
            <span className="text-slate-500 block">Current TPS</span>
            <span className="font-mono font-semibold text-cyan-400">{currentTps} TPS (Burst 1,200)</span>
          </div>
          <div>
            <span className="text-slate-500 block">Storage Replication</span>
            <span className="font-mono font-semibold text-emerald-400">{auroraLag}ms (RPO &lt; 1s)</span>
          </div>
          <div>
            <span className="text-slate-500 block">Route 53 ARC RTO</span>
            <span className="font-mono font-semibold text-amber-400">&lt; 180s (Automated)</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="border-b border-slate-800 bg-slate-950 px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto text-sm">
          {[
            { id: 'architecture', label: 'Multi-Region Topology', icon: Globe },
            { id: 'telemetry', label: 'Replication & Telemetry', icon: Activity },
            { id: 'runbooks', label: '12 DR Runbooks Suite', icon: Terminal },
            { id: 'compliance', label: 'Regulatory Compliance Matrix', icon: Scale },
            { id: 'bcrb', label: 'BCRB Defense & Board Sign-Off', icon: Users },
            { id: 'tooling', label: 'IaC & Automation Tooling', icon: Layers }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {/* TAB 1: ARCHITECTURE TOPOLOGY */}
        {activeTab === 'architecture' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-emerald-400" />
                    Hybrid Sharded Active-Active & Warm Core Topology
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Ingress & Idempotency are Active-Active. Core Double-Entry Transaction Ledger is Single-Primary with sub-second physical storage replication across AWS Indian regions.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                    Mumbai (Zone III) ➔ Hyderabad (Zone II) [~620 km separation]
                  </span>
                </div>
              </div>

              {/* Architecture Diagram Interactive Canvas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mumbai Region Card */}
                <div className={`p-5 rounded-xl border transition-all ${
                  activeRegion === 'ap-south-1'
                    ? 'bg-slate-900/90 border-emerald-500/40 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/20'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                }`}>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${activeRegion === 'ap-south-1' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
                      <h3 className="font-bold text-white">ap-south-1 (Mumbai Region)</h3>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded font-mono font-semibold ${
                      activeRegion === 'ap-south-1' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {activeRegion === 'ap-south-1' ? 'PRIMARY WRITER' : 'STANDBY REPLICA'}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                      <div className="font-semibold text-slate-200 flex items-center justify-between">
                        <span>External ALB & AWS WAF</span>
                        <span className="text-emerald-400">100% Ingress (ARC Control ON)</span>
                      </div>
                      <p className="text-slate-500 mt-1">Multi-AZ ingress terminating client checkouts and merchant API webhooks.</p>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                      <div className="font-semibold text-slate-200 flex items-center justify-between">
                        <span>Amazon EKS Production Fleet</span>
                        <span className="font-mono text-cyan-400">24x c6i.4xlarge (384 vCPU)</span>
                      </div>
                      <p className="text-slate-500 mt-1">Orchestrator, UPI Switch Connector, Settlement & Ledger services.</p>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                      <div className="font-semibold text-slate-200 flex items-center justify-between">
                        <span>Amazon Aurora PostgreSQL Global DB</span>
                        <span className="font-mono text-emerald-400">Writer + 2 Readers</span>
                      </div>
                      <p className="text-slate-500 mt-1">Strict ACID double-entry accounting. Streams physical redo blocks to Hyderabad.</p>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                      <div className="font-semibold text-slate-200 flex items-center justify-between">
                        <span>Amazon DynamoDB Global Table</span>
                        <span className="font-mono text-emerald-400">Active-Active (<span className="text-cyan-400">{ddbSync}ms</span>)</span>
                      </div>
                      <p className="text-slate-500 mt-1">Distributed idempotency store & cardholder token vault.</p>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                      <div className="font-semibold text-slate-200 flex items-center justify-between">
                        <span>Amazon MSK Cluster</span>
                        <span className="font-mono text-purple-400">6 Brokers (3 AZs)</span>
                      </div>
                      <p className="text-slate-500 mt-1">Primary event pipeline; source for AWS MSK Replicator.</p>
                    </div>
                  </div>
                </div>

                {/* Hyderabad Region Card */}
                <div className={`p-5 rounded-xl border transition-all ${
                  activeRegion === 'ap-south-2'
                    ? 'bg-slate-900/90 border-emerald-500/40 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/20'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                }`}>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${activeRegion === 'ap-south-2' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
                      <h3 className="font-bold text-white">ap-south-2 (Hyderabad DR Region)</h3>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded font-mono font-semibold ${
                      activeRegion === 'ap-south-2' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {activeRegion === 'ap-south-2' ? 'PRIMARY WRITER (PROMOTED)' : 'HOT STANDBY (WARM CORE)'}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                      <div className="font-semibold text-slate-200 flex items-center justify-between">
                        <span>External ALB (Warm Standby)</span>
                        <span className="text-slate-400">Standby (ARC Control Ready)</span>
                      </div>
                      <p className="text-slate-500 mt-1">Pre-provisioned with Anycast edge endpoints, ready for instantaneous cutover.</p>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                      <div className="font-semibold text-slate-200 flex items-center justify-between">
                        <span>Amazon EKS Warm Standby Fleet</span>
                        <span className="font-mono text-cyan-400">10x c6i.4xlarge (Expands to 28x in 90s)</span>
                      </div>
                      <p className="text-slate-500 mt-1">Running 40% warm compute; Karpenter autoscales to 100% capacity upon failover.</p>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                      <div className="font-semibold text-slate-200 flex items-center justify-between">
                        <span>Amazon Aurora Global DB Replica</span>
                        <span className="font-mono text-emerald-400">Lag: {auroraLag}ms (Physical Sync)</span>
                      </div>
                      <p className="text-slate-500 mt-1">Continuously applies physical redo logs over dedicated AWS backbone link.</p>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                      <div className="font-semibold text-slate-200 flex items-center justify-between">
                        <span>Amazon DynamoDB Global Table</span>
                        <span className="font-mono text-emerald-400">Active-Active (<span className="text-cyan-400">{ddbSync}ms</span>)</span>
                      </div>
                      <p className="text-slate-500 mt-1">Synchronized multi-region replica; receives immediate retry queries without lag.</p>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
                      <div className="font-semibold text-slate-200 flex items-center justify-between">
                        <span>Amazon MSK DR Cluster</span>
                        <span className="font-purple-400 font-mono">MSK Replicator (Lag: {kafkaLag} msgs)</span>
                      </div>
                      <p className="text-slate-500 mt-1">Mirror cluster with consumer offset translation for webhook & settlement dispatch.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Inter-Region Peering Backbone Banner */}
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-indigo-400" />
                    <div>
                      <span className="font-bold text-white block">Dedicated Sovereign Domestic Inter-Region Transit Gateway Peering</span>
                      <span className="text-slate-400">Encrypted AWS physical fiber backbone • RTT: 18.2ms • Jumbo Frames MTU 8500 • Zero cross-border transit</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 font-mono">
                    <span className="text-slate-400">Storage Lag: <strong className="text-emerald-400">{auroraLag} ms</strong></span>
                    <span className="text-slate-400">Idempotency Lag: <strong className="text-cyan-400">{ddbSync} ms</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture Decision Comparison Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <h3 className="text-base font-bold text-white mb-4">Architecture Trade-off Evaluation (Payment Gateway Reality)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono">
                    <tr>
                      <th className="p-3">Dimension</th>
                      <th className="p-3">Pure Active-Active (Multi-Master)</th>
                      <th className="p-3">Active-Passive (Hot Standby)</th>
                      <th className="p-3 text-emerald-400">Hybrid Sharded Model (PaySecure Selected)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr>
                      <td className="p-3 font-semibold text-white">Ledger Consistency</td>
                      <td className="p-3 text-red-400">High latency 2PC adds 50-70ms write overhead; breaches UPI 2.5s timeout.</td>
                      <td className="p-3">Strong consistency; single writer.</td>
                      <td className="p-3 text-emerald-300 font-medium">Optimal: Ingress & idempotency active-active; ledger single primary with &lt;1s storage replication.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-white">RPO SLA</td>
                      <td className="p-3">0 seconds</td>
                      <td className="p-3">1 - 5 seconds</td>
                      <td className="p-3 text-emerald-300 font-mono font-medium">&lt; 1 second (Achieved: 420ms storage sync)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-white">RTO SLA</td>
                      <td className="p-3">0 seconds</td>
                      <td className="p-3">2 - 4 minutes</td>
                      <td className="p-3 text-emerald-300 font-mono font-medium">&lt; 3 minutes (Route 53 ARC automated cutover)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-white">Split-Brain Risk</td>
                      <td className="p-3 text-red-400">High: Partition causes conflicting ledger states.</td>
                      <td className="p-3">Low: Single primary.</td>
                      <td className="p-3 text-emerald-300 font-medium">Eliminated: Route 53 ARC 5-region consensus control plane enforces single-writer assertion.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-white">Monthly Cost Multiplier</td>
                      <td className="p-3">2.1x baseline (₹77 Lakhs/mo)</td>
                      <td className="p-3">1.4x baseline</td>
                      <td className="p-3 text-emerald-300 font-medium">1.65x baseline (Warm Compute 40% + Hot Storage = ₹63.52 Lakhs/mo)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REPLICATION & TELEMETRY */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-400" />
                    Aurora PostgreSQL Global DB
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    SYNCED
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-white mt-1">{auroraLag} ms</div>
                <p className="text-xs text-slate-500 mt-2">Physical Storage Redo Log Lag. Regulatory SLA: &lt; 60,000 ms.</p>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Target RPO: &lt; 1s</span>
                  <span className="text-emerald-400 font-semibold font-mono">PASSED</span>
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    DynamoDB Global Tables
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    ACTIVE-ACTIVE
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-white mt-1">{ddbSync} ms</div>
                <p className="text-xs text-slate-500 mt-2">Idempotency & Token Store Replication Latency across regions.</p>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Consistency: Eventual</span>
                  <span className="text-cyan-400 font-semibold font-mono">99.999% SLA</span>
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    ElastiCache Redis Global
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    MIRRORED
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-white mt-1">{redisSync} ms</div>
                <p className="text-xs text-slate-500 mt-2">BIN Routing & Merchant Rate Limit synchronization lag.</p>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Promotion RTO: &lt; 60s</span>
                  <span className="text-amber-400 font-semibold font-mono">READY</span>
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-purple-400" />
                    Amazon MSK Replicator
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    OFFSET SYNC
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-white mt-1">{kafkaLag} msgs</div>
                <p className="text-xs text-slate-500 mt-2">Cross-cluster uncommitted message lag on payment.events.</p>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Deduplication: Active</span>
                  <span className="text-purple-400 font-semibold font-mono">EXACTLY-ONCE</span>
                </div>
              </div>
            </div>

            {/* CloudWatch Replication Telemetry Log Simulation */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Live AWS CloudWatch & Datadog Telemetry Stream
                </h3>
                <span className="text-xs font-mono text-slate-400">Interval: 10s • Target Health: NOMINAL</span>
              </div>
              <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-2 border border-slate-800/80">
                <div className="text-slate-500">[2026-10-01 18:25:01 UTC] [AWS/RDS] AuroraGlobalDBReplicationLag: {auroraLag}ms (ap-south-1 to ap-south-2) - Health: OK</div>
                <div className="text-slate-500">[2026-10-01 18:25:11 UTC] [AWS/DynamoDB] GlobalTableReplicationLatency: {ddbSync}ms across 45,000 merchant partitions - Health: OK</div>
                <div className="text-slate-500">[2026-10-01 18:25:21 UTC] [AWS/ElastiCache] GlobalReplicationGroupDataLag: {redisSync}ms - Primary node CPU: 24% - Health: OK</div>
                <div className="text-slate-500">[2026-10-01 18:25:31 UTC] [AWS/MSK] ReplicatorConsumerLag: {kafkaLag} messages - Offset translation committed - Health: OK</div>
                <div className="text-emerald-400">[2026-10-01 18:25:41 UTC] [Route53-ARC] Readiness Checks (ap-south-2): PASS (Compute: 160 vCPU Warm, Storage: In-Sync)</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 12 DR RUNBOOKS SUITE */}
        {activeTab === 'runbooks' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Runbooks Sidebar (12 Scenarios) */}
            <div className="lg:col-span-4 space-y-2 max-h-[750px] overflow-y-auto pr-1">
              {runbooks.map((rb) => {
                const isSelected = selectedRunbookId === rb.id;
                return (
                  <button
                    key={rb.id}
                    onClick={() => {
                      setSelectedRunbookId(rb.id);
                      setRunbookLogs([]);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all text-xs ${
                      isSelected
                        ? 'bg-slate-900 border-emerald-500/50 shadow-md shadow-emerald-500/5'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-bold text-slate-300">{rb.id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rb.sev === 'SEV-1' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {rb.sev}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-100 line-clamp-1">{rb.title}</div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                      <span>RTO: <strong className="text-slate-300">{rb.rto}</strong></span>
                      <span>•</span>
                      <span>RPO: <strong className="text-slate-300">{rb.rpo}</strong></span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Runbook Details & Execution Console */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-emerald-400 font-bold text-sm">{selectedRunbook.id}</span>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-500/20 text-red-400 border border-red-500/30">
                        {selectedRunbook.sev}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white mt-1">{selectedRunbook.title}</h2>
                    <p className="text-xs text-slate-400 mt-1">{selectedRunbook.summary}</p>
                  </div>
                  <button
                    onClick={() => handleExecuteRunbook(selectedRunbook)}
                    disabled={runbookExecuting}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{runbookExecuting ? 'Executing Runbook...' : 'Run Scenario Simulation'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4 text-xs">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 block">Target RTO</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">{selectedRunbook.rto}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 block">Target RPO</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">{selectedRunbook.rpo}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                    <span className="text-slate-500 block">Trigger Condition</span>
                    <span className="font-semibold text-slate-300 line-clamp-1">{selectedRunbook.trigger}</span>
                  </div>
                </div>

                {/* Step-by-Step Procedure */}
                <div className="mt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Procedural Playbook Steps</h4>
                  <div className="space-y-2 text-xs">
                    {selectedRunbook.steps.map((st, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-slate-200">{st}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Execution Log Output Console */}
                <div className="mt-6 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      Automated Execution Audit Log
                    </h4>
                    {runbookExecuting && (
                      <span className="text-[11px] font-mono text-emerald-400 animate-pulse flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Live Executing...
                      </span>
                    )}
                  </div>
                  <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-1.5 min-h-[160px] max-h-[240px] overflow-y-auto border border-slate-800/80">
                    {runbookLogs.length === 0 ? (
                      <span className="text-slate-600 italic">Click "Run Scenario Simulation" to test automated runbook execution and calculate live RTO/RPO metrics.</span>
                    ) : (
                      runbookLogs.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-slate-600">[{log.timestamp}]</span>
                          <span className={log.message.includes('SUCCESS') ? 'text-emerald-400 font-semibold' : log.message.includes('INIT') ? 'text-cyan-400' : 'text-slate-300'}>
                            {log.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REGULATORY & COMPLIANCE MATRIX */}
        {activeTab === 'compliance' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Scale className="w-5 h-5 text-emerald-400" />
                    Regulatory & Compliance Mapping Matrix
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Every architectural component is mapped to statutory mandates from RBI, PCI Security Standards Council, NPCI, and Indian data protection laws.
                  </p>
                </div>

                {/* Filter Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {['ALL', 'RBI', 'PCI-DSS', 'NPCI', 'DPDP'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setSelectedComplianceFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                        selectedComplianceFilter === filter
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compliance Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono">
                    <tr>
                      <th className="p-3">Authority & Clause</th>
                      <th className="p-3">Statutory Regulatory Mandate</th>
                      <th className="p-3">PaySecure Architectural Implementation</th>
                      <th className="p-3">Audit Verification Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredCompliance.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 font-semibold text-white whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mr-2">
                            {item.authority}
                          </span>
                          <span className="block mt-1 text-slate-400 font-mono text-[11px]">{item.clause}</span>
                        </td>
                        <td className="p-3 text-slate-300 max-w-xs">{item.mandate}</td>
                        <td className="p-3 text-emerald-300/90 max-w-md">{item.implementation}</td>
                        <td className="p-3 text-slate-400 font-mono text-[11px] max-w-xs">{item.verification}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: BCRB DEFENSE & BOARD SIGN-OFF */}
        {activeTab === 'bcrb' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    Business Continuity Review Board (BCRB) Defense
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Simulated executive review and architectural sign-off proceedings with PaySecure's 5 key executive stakeholders.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    UNANIMOUS BOARD APPROVAL GRANTED
                  </span>
                </div>
              </div>

              {/* Stakeholder Selector */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                {Object.keys(stakeholders).map((k) => {
                  const s = stakeholders[k];
                  const isCurrent = activeStakeholder === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setActiveStakeholder(k)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isCurrent
                          ? 'bg-slate-900 border-emerald-500/50 shadow-md shadow-emerald-500/5'
                          : 'bg-slate-950/60 border-slate-800 hover:bg-slate-900/50'
                      }`}
                    >
                      <span className="text-[10px] font-mono text-emerald-400 font-bold block">{s.role}</span>
                      <span className="text-xs font-bold text-white mt-0.5 block truncate">{s.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Interactive Q&A Defense Card */}
              {(() => {
                const s = stakeholders[activeStakeholder];
                return (
                  <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-sm shrink-0">
                        {s.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{s.name}</span>
                          <span className="text-xs text-slate-400">({s.role})</span>
                        </div>
                        <div className="mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 font-medium">
                          <strong>Cross-Examination Question:</strong> "{s.question}"
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pl-14">
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200/90 leading-relaxed space-y-2">
                        <div className="font-bold text-emerald-400 flex items-center gap-2">
                          <Shield className="w-4 h-4" /> Lead DR Architect Defense:
                        </div>
                        <p>{s.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 6: IAC & AUTOMATION TOOLING */}
        {activeTab === 'tooling' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-400" />
                    Automation Tooling & Infrastructure as Code (Terraform)
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Execute Python automated failover & reconciliation tools in-browser or inspect multi-region Terraform HCL blueprints.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTool('orchestrator')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      activeTool === 'orchestrator' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    dr_orchestrator.py
                  </button>
                  <button
                    onClick={() => setActiveTool('reconciler')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      activeTool === 'reconciler' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    reconciliation_tool.py
                  </button>
                  <button
                    onClick={() => setActiveTool('terraform')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      activeTool === 'terraform' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Terraform IaC (HCL)
                  </button>
                </div>
              </div>

              {/* Active Tool View */}
              {activeTool !== 'terraform' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">
                      Running script: <strong className="text-emerald-400">{activeTool === 'orchestrator' ? 'docs/scripts/dr_orchestrator.py' : 'docs/scripts/reconciliation_tool.py'}</strong>
                    </span>
                    <button
                      onClick={() => handleRunScript(activeTool)}
                      disabled={scriptRunning}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-2 shadow-md shadow-emerald-500/20 disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{scriptRunning ? 'Executing Script...' : 'Execute Script In-Browser'}</span>
                    </button>
                  </div>

                  <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 font-mono text-xs">
                    <pre className="text-emerald-400 overflow-x-auto">
                      {scriptRunning ? (
                        <span className="text-slate-500 animate-pulse">Executing script logic and querying telemetry endpoints...</span>
                      ) : scriptOutput ? (
                        JSON.stringify(scriptOutput, null, 2)
                      ) : (
                        <span className="text-slate-600 italic">Click "Execute Script In-Browser" to test the Python automation tool.</span>
                      )}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">File: <strong className="text-white">loan-app/terraform/route53_arc.tf</strong></span>
                    <button
                      onClick={() => handleCopy(`resource "aws_route53recoverycontrolconfig_cluster" "paysecure_arc_cluster" {\n  name = "paysecure-dr-control-cluster"\n}`, 'tf')}
                      className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedKey === 'tf' ? 'Copied!' : 'Copy HCL Snippet'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 font-mono text-xs overflow-x-auto text-slate-300">
                    <pre>{`# Route 53 ARC Safety Assertion Rule (Prevents Split-Brain)
resource "aws_route53recoverycontrolconfig_safety_rule" "split_brain_prevention" {
  name              = "paysecure-split-brain-assertion"
  control_panel_arn = aws_route53recoverycontrolconfig_control_panel.paysecure_panel.arn
  wait_period_ms    = 5000
  inverted          = false

  rule_config {
    inverted  = false
    threshold = 1
    type      = "ATLEAST"
  }

  asserted_controls = [
    aws_route53recoverycontrolconfig_routing_control.mumbai_control.arn,
    aws_route53recoverycontrolconfig_routing_control.hyderabad_control.arn
  ]
}`}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <span>PaySecure Gateway Private Limited • Multi-Region DR Architecture Baseline v3.4</span>
            <span className="block mt-0.5 text-slate-600">Compliant with RBI PA/PG Circular, RBI MD-IT 2023, PCI-DSS v4.0 & DPDP Act 2023</span>
          </div>
          <div className="font-mono text-slate-400">
            Sovereign Republic of India Territory • ap-south-1 & ap-south-2
          </div>
        </div>
      </footer>
    </div>
  );
}
