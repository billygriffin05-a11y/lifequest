/**
 * Starter CompTIA Security+ (SY0-701) cards, written for LIFEQUEST from general
 * security knowledge — not copied from CompTIA or any course. Topics follow the
 * five exam domains. Edit or archive any card in the app.
 */
export interface StarterCard {
  key: string;
  topic: string;
  front: string;
  back: string;
}

const D1 = "1 · General security concepts";
const D2 = "2 · Threats & mitigations";
const D3 = "3 · Security architecture";
const D4 = "4 · Security operations";
const D5 = "5 · Programme management";

export const STARTER_DECK: readonly StarterCard[] = [
  { key: "cia", topic: D1, front: "What does the CIA triad stand for?", back: "Confidentiality, Integrity, Availability." },
  { key: "aaa", topic: D1, front: "What is AAA?", back: "Authentication (prove who you are), Authorisation (what you may do), Accounting (record what you did)." },
  { key: "non-repudiation", topic: D1, front: "What is non-repudiation?", back: "Proof that someone did an action so they can't deny it later — e.g. a digital signature." },
  { key: "zero-trust", topic: D1, front: "Zero Trust in one line?", back: "Never trust by network location; verify every request (identity, device, context) every time." },
  { key: "control-types", topic: D1, front: "Name the four control categories.", back: "Technical, Managerial, Operational, Physical." },
  { key: "control-functions", topic: D1, front: "Preventive vs detective vs corrective control?", back: "Preventive stops it (firewall); detective spots it (IDS, logs); corrective fixes it after (restore from backup)." },
  { key: "symmetric", topic: D1, front: "Symmetric vs asymmetric encryption?", back: "Symmetric: one shared key, fast (AES). Asymmetric: public/private key pair, slower, used for key exchange and signatures (RSA, ECC)." },
  { key: "hashing", topic: D1, front: "What is hashing used for, and is it reversible?", back: "Integrity checks and password storage. It is one-way — not reversible. Example: SHA-256." },
  { key: "salt", topic: D1, front: "Why salt a password hash?", back: "A unique random salt per password makes identical passwords hash differently and defeats precomputed rainbow tables." },
  { key: "pki", topic: D1, front: "What does a Certificate Authority (CA) do?", back: "Signs digital certificates that bind a public key to an identity, so others can trust that key." },

  { key: "phishing", topic: D2, front: "Phishing vs spear phishing vs whaling?", back: "Phishing: mass fake messages. Spear phishing: targeted at a person/group. Whaling: targeted at senior executives." },
  { key: "smishing", topic: D2, front: "What are smishing and vishing?", back: "Smishing = phishing by SMS text. Vishing = phishing by voice call." },
  { key: "ransomware", topic: D2, front: "What is ransomware and the best recovery control?", back: "Malware that encrypts data and demands payment. Best recovery: tested, offline/immutable backups." },
  { key: "sqli", topic: D2, front: "How do you prevent SQL injection?", back: "Parameterised queries / prepared statements, plus input validation and least-privilege database accounts." },
  { key: "xss", topic: D2, front: "What is cross-site scripting (XSS)?", back: "Injecting script into a web page that runs in other users' browsers. Prevent with output encoding/escaping and a Content Security Policy." },
  { key: "zero-day", topic: D2, front: "What is a zero-day?", back: "A vulnerability unknown to the vendor with no patch available yet." },
  { key: "mitm", topic: D2, front: "What is an on-path (man-in-the-middle) attack?", back: "An attacker secretly sits between two parties to read or alter traffic. TLS with certificate checks mitigates it." },
  { key: "ddos", topic: D2, front: "DoS vs DDoS?", back: "DoS floods a target from one source; DDoS uses many sources (often a botnet), making it harder to block." },

  { key: "dmz", topic: D3, front: "What is a DMZ (screened subnet)?", back: "A network zone between the internet and the internal network that hosts public-facing services." },
  { key: "segmentation", topic: D3, front: "Why segment a network?", back: "To limit how far an attacker can move laterally and to contain breaches (VLANs, subnets, firewalls)." },
  { key: "rto-rpo", topic: D3, front: "RTO vs RPO?", back: "RTO: how fast you must be back up. RPO: how much data (time) you can afford to lose." },
  { key: "raid1", topic: D3, front: "RAID 1 vs RAID 5?", back: "RAID 1 mirrors two disks. RAID 5 stripes with parity across 3+ disks and survives one disk failure." },
  { key: "iac", topic: D3, front: "Security benefit of Infrastructure as Code?", back: "Repeatable, reviewable, version-controlled configuration — fewer manual mistakes and easy rebuilds." },

  { key: "least-privilege", topic: D4, front: "What is least privilege?", back: "Give users and services only the access they need to do their job — nothing more." },
  { key: "mfa", topic: D4, front: "What are the MFA factor types?", back: "Something you know (PIN), have (phone, token), are (fingerprint). MFA uses two or more different types." },
  { key: "siem", topic: D4, front: "What does a SIEM do?", back: "Collects and correlates logs from many sources to detect, alert on and investigate security events." },
  { key: "ir-steps", topic: D4, front: "Incident response phases (in order)?", back: "Preparation, Detection, Analysis, Containment, Eradication, Recovery, Lessons learned." },
  { key: "ids-ips", topic: D4, front: "IDS vs IPS?", back: "IDS detects and alerts. IPS sits inline and can block traffic." },
  { key: "edr", topic: D4, front: "What is EDR?", back: "Endpoint Detection and Response: monitors endpoints for suspicious behaviour and lets you investigate and respond." },
  { key: "chain-custody", topic: D4, front: "Why keep a chain of custody?", back: "To prove evidence was handled and stored without tampering, so it stays admissible." },

  { key: "risk-formula", topic: D5, front: "Risk = ?", back: "Likelihood × impact. (Quantitatively: ALE = SLE × ARO.)" },
  { key: "ale", topic: D5, front: "What are SLE, ARO and ALE?", back: "SLE: cost of one incident. ARO: incidents expected per year. ALE (annual loss expectancy) = SLE × ARO." },
  { key: "risk-responses", topic: D5, front: "Four ways to respond to a risk?", back: "Mitigate, Transfer (e.g. insurance), Accept, Avoid." },
  { key: "gdpr", topic: D5, front: "What is the UK GDPR about?", back: "Protecting personal data: lawful basis, data minimisation, individuals' rights, and breach reporting (to the ICO within 72 hours when required)." },
  { key: "aup", topic: D5, front: "What is an Acceptable Use Policy (AUP)?", back: "Rules users agree to for how they may use an organisation's systems and data." },
  { key: "pentest-types", topic: D5, front: "Known vs unknown vs partially known environment testing?", back: "Known (white box): full info given. Unknown (black box): no info. Partially known (grey box): some info." },
];
