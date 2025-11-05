# PoRV Technology Licensing System - Technical Documentation

## Overview

The Proof-of-Residual-Value (PoRV) consensus system is a proprietary technology developed by Kenostod Blockchain Academy. This document outlines the technical implementation of the licensing and profit-sharing system that governs commercial use of PoRV technology.

## Legal Framework

### Licensing Terms

**License Type:** Commercial License with Mandatory Profit-Sharing

**Creator Royalty Rate:** 10% of all gross revenue generated using PoRV technology

**Creator Address:** `04ec760c787ea85d7d73181dfdd5b8bc87dc94793ec929c09db6b43276ddb8900b204d9a22158d053feb56c1e2a9f08037251e3bd19e0d468e63eff1ee55e6f89e`

### Licensing Requirements

1. **Registration:** All platforms implementing PoRV must register via API
2. **Payment:** 10% of gross revenue paid to creator address on-chain
3. **Reporting:** All usage must be reported with cryptographic proof
4. **Compliance:** Maintain active license through timely payments
5. **Attribution:** Credit Kenostod Blockchain Academy as PoRV creator
6. **Enforcement:** Violations result in license suspension + legal action

## Technical Implementation

### Backend Architecture

#### License Registry (`porvLicenses` array)
- In-memory storage for license records
- Each license tracks: platform details, status, revenue, royalty payments, usage history
- Future enhancement: Migrate to persistent database storage

#### License Status Lifecycle
```
pending → active → suspended
   ↓         ↓          ↓
 (awaits   (can      (cannot
approval)   use)      use)
```

### API Endpoints

#### 1. Register for License
**Endpoint:** `POST /api/porv/license/register`

**Request Body:**
```json
{
  "platformName": "string (required)",
  "companyName": "string (required)",
  "contactEmail": "string (required)",
  "walletAddress": "string (required)",
  "agreedToTerms": true (required)
}
```

**Response:**
```json
{
  "message": "PoRV Technology License application submitted",
  "license": {
    "licenseId": "PORV-LIC-{timestamp}-{random}",
    "platformName": "string",
    "companyName": "string",
    "contactEmail": "string",
    "walletAddress": "string",
    "issuedAt": "ISO 8601 timestamp",
    "status": "pending",
    "agreedToTerms": true,
    "creatorRoyaltyRate": 10,
    "totalRevenue": 0,
    "creatorRoyaltiesPaid": 0,
    "usageHistory": []
  },
  "terms": {
    "creatorRoyaltyRate": "10%",
    "creatorAddress": "string",
    "requirement": "string",
    "enforcement": "string",
    "violation": "string"
  }
}
```

**Business Logic:**
1. Validates all required fields present
2. Verifies agreedToTerms is true
3. Generates unique license ID
4. Creates license record with "pending" status
5. Returns license details and terms

---

#### 2. Report Usage & Pay Creator Royalties
**Endpoint:** `POST /api/porv/license/report-usage`

**Request Body:**
```json
{
  "licenseId": "string (required)",
  "revenueGenerated": number (required),
  "royaltyPaymentTx": {
    "fromAddress": "string",
    "toAddress": "string (must be PORV_CREATOR_ADDRESS)",
    "amount": number (must be >= 10% of revenueGenerated),
    "timestamp": number,
    "signature": "string (cryptographic signature)"
  }
}
```

**Response:**
```json
{
  "message": "PoRV usage reported and creator royalties paid successfully",
  "license": {
    "licenseId": "string",
    "platformName": "string",
    "totalRevenue": number,
    "totalCreatorRoyalties": number,
    "complianceStatus": "compliant"
  },
  "payment": {
    "creatorRoyaltyPaid": number,
    "transactionHash": "string",
    "creatorAddress": "string"
  }
}
```

**Payment Verification Logic (Multi-Layer Enforcement):**

1. **License Validation:**
   - Verify license exists in registry
   - Check license status is "active" (reject if pending/suspended)

2. **Royalty Calculation:**
   ```javascript
   creatorRoyaltyDue = revenueGenerated * 0.10
   ```

3. **Payment Amount Verification:**
   ```javascript
   if (royaltyPaymentTx.amount < creatorRoyaltyDue) {
     throw Error("Insufficient creator royalty payment")
   }
   ```

4. **Recipient Address Verification:**
   ```javascript
   if (royaltyPaymentTx.toAddress !== PORV_CREATOR_ADDRESS) {
     throw Error("Invalid payment recipient")
   }
   ```

5. **Cryptographic Signature Validation:**
   ```javascript
   const tx = kenostodChain.createTransactionFromObject(royaltyPaymentTx)
   if (!tx.isValid()) {
     throw Error("Invalid transaction signature")
   }
   ```

6. **On-Chain Submission:**
   ```javascript
   kenostodChain.addTransaction(tx)
   ```

7. **Usage Recording:**
   - Update license.totalRevenue
   - Update license.creatorRoyaltiesPaid
   - Append to license.usageHistory[]

**Security Guarantees:**
- Payments are cryptographically signed (prevents forgery)
- Amount verified server-side (prevents underpayment)
- Recipient hardcoded (prevents misdirection)
- Transaction submitted on-chain (immutable audit trail)

---

#### 3. Get License Information
**Endpoint:** `GET /api/porv/license/:licenseId`

**Response:**
```json
{
  "license": { /* full license object */ },
  "compliance": {
    "expectedCreatorRoyaltyRate": "10%",
    "totalRevenue": number,
    "creatorRoyaltiesPaid": number,
    "compliancePercentage": "string (calculated)"
  }
}
```

---

#### 4. Get All Licenses (Admin)
**Endpoint:** `GET /api/porv/licenses`

**Response:**
```json
{
  "totalLicenses": number,
  "activeLicenses": number,
  "totalRevenueGenerated": number,
  "totalCreatorRoyalties": number,
  "licenses": [
    {
      "licenseId": "string",
      "platformName": "string",
      "companyName": "string",
      "status": "string",
      "totalRevenue": number,
      "creatorRoyaltiesPaid": number,
      "issuedAt": "string"
    }
  ]
}
```

---

#### 5. Approve License (Admin)
**Endpoint:** `POST /api/porv/license/:licenseId/approve`

**Business Logic:**
1. Find license by ID
2. Verify status is "pending"
3. Update status to "active"
4. Record approval timestamp

**Status Transition:**
```
pending → active (approved)
```

---

#### 6. Get Licensing Terms
**Endpoint:** `GET /api/porv/license/terms`

**Response:** Complete licensing terms, requirements, benefits, and registration info

---

## Compliance Tracking

### Per-License Metrics
- **totalRevenue:** Cumulative revenue reported
- **creatorRoyaltiesPaid:** Cumulative royalties paid to creator
- **compliancePercentage:** (creatorRoyaltiesPaid / totalRevenue) * 100
  - **Expected:** 10%
  - **Acceptable:** ≥10% (overpayment allowed)
  - **Non-compliant:** <10% (triggers license suspension)

### Usage History
Each usage report creates an immutable record:
```javascript
{
  timestamp: "ISO 8601",
  revenue: number,
  creatorRoyalty: number,
  transactionHash: "string (on-chain proof)"
}
```

## Enforcement Mechanisms

### Technical Enforcement

1. **API-Level Blocking:**
   - Only "active" licenses can report usage
   - "pending" licenses blocked until approved
   - "suspended" licenses completely blocked

2. **Payment Verification:**
   - Amount must be ≥10% of revenue
   - Recipient must be PORV_CREATOR_ADDRESS
   - Signature must be cryptographically valid
   - Transaction must be submitted on-chain

3. **Compliance Monitoring:**
   - Real-time tracking of compliance percentage
   - Automatic calculation of expected vs. actual royalties

### Legal Enforcement

1. **License Agreement:** Terms accepted during registration
2. **Suspension:** Non-compliant platforms lose API access
3. **Legal Action:** Unlicensed usage or non-payment triggers litigation

## Integration Guide for Licensed Platforms

### Step 1: Apply for License
```javascript
const response = await fetch('/api/porv/license/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    platformName: 'Your Platform',
    companyName: 'Your Company LLC',
    contactEmail: 'tech@yourcompany.com',
    walletAddress: 'your-keno-wallet-address',
    agreedToTerms: true
  })
});

const { license } = await response.json();
const licenseId = license.licenseId; // Save this!
```

### Step 2: Wait for Approval
- Status: `pending` → `active`
- Monitor via `GET /api/porv/license/:licenseId`

### Step 3: Report Usage & Pay Royalties
```javascript
// When your platform earns revenue using PoRV
const revenue = 1000; // KENO earned
const creatorRoyalty = revenue * 0.10; // 100 KENO

// Create signed transaction to creator
const royaltyTx = {
  fromAddress: yourPlatformWallet,
  toAddress: PORV_CREATOR_ADDRESS,
  amount: creatorRoyalty,
  timestamp: Date.now(),
  signature: signTransaction(/* ... */)
};

// Report usage
await fetch('/api/porv/license/report-usage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    licenseId: licenseId,
    revenueGenerated: revenue,
    royaltyPaymentTx: royaltyTx
  })
});
```

### Step 4: Maintain Compliance
- Report ALL revenue from PoRV usage
- Pay royalties immediately upon earning
- Monitor compliance percentage stays ≥10%
- Keep license active through timely payments

## Security Considerations

### Threat Model

**Threat:** Platform reports revenue but sends insufficient royalty payment
**Mitigation:** Server-side amount verification (line 1281-1285)

**Threat:** Platform sends payment to wrong address
**Mitigation:** Hardcoded recipient verification (line 1287-1291)

**Threat:** Platform forges transaction signature
**Mitigation:** Cryptographic signature validation (line 1294-1297)

**Threat:** Platform uses PoRV without license
**Mitigation:** API requires valid licenseId + "active" status

**Threat:** Platform underreports revenue
**Mitigation:** On-chain audit trail allows third-party verification

### Data Persistence

**Current:** In-memory storage (porvLicenses array)
**Limitation:** Data lost on server restart
**Future Enhancement:** Migrate to PostgreSQL for persistence

**Workaround:** Export/import license data on server start/stop

## Benefits to PoRV Creator

### Revenue Streams

1. **Direct Royalties:** 10% of all external platform revenue
2. **Network Effects:** More platforms = more revenue
3. **Technology Licensing:** One-time or recurring license fees
4. **Consulting Services:** Implementation support for licensees

### On-Chain Benefits

- All royalty payments are on-chain (transparent, verifiable)
- Automatic distribution to creator address
- Immutable audit trail of all usage
- Real-time revenue tracking

## Benefits to Licensed Platforms

### Technology Access

1. **Revolutionary Consensus:** PoRV generates real economic value
2. **RVT System:** Perpetual royalty-generating NFTs
3. **Deflationary Economics:** Built-in buy-and-burn mechanism
4. **Competitive Advantage:** Unique features vs. Bitcoin/Ethereum

### Business Model

- Keep 90% of all revenue (fair profit-sharing)
- Differentiate from competitors
- Access to ongoing R&D improvements
- Legal protection and support

## Example Use Cases

### 1. Blockchain Platform License
**Platform:** "BlockchainX" launching new cryptocurrency
**Revenue:** Transaction fees, mining rewards, network usage
**Royalty:** 10% of transaction fees paid monthly

### 2. Enterprise SaaS License
**Platform:** "CloudAI" using PoRV for computational marketplace
**Revenue:** Customer subscription fees
**Royalty:** 10% of subscription revenue paid quarterly

### 3. DeFi Protocol License
**Platform:** "DeFiSwap" using RVTs as collateral
**Revenue:** Trading fees, lending interest
**Royalty:** 10% of protocol revenue paid weekly

## Compliance Examples

### Compliant Platform
```
Revenue: 10,000 KENO
Expected Royalty: 1,000 KENO (10%)
Actual Payment: 1,000 KENO
Compliance: 100% ✅
Status: Active
```

### Over-Compliant Platform (Allowed)
```
Revenue: 10,000 KENO
Expected Royalty: 1,000 KENO (10%)
Actual Payment: 1,200 KENO (12%)
Compliance: 120% ✅
Status: Active
```

### Non-Compliant Platform (Suspended)
```
Revenue: 10,000 KENO
Expected Royalty: 1,000 KENO (10%)
Actual Payment: 800 KENO (8%)
Compliance: 80% ❌
Status: Suspended
Action: Pay outstanding 200 KENO to reactivate
```

## Future Enhancements

### Phase 1: Database Persistence
- Migrate from in-memory to PostgreSQL
- Ensure license data survives server restarts
- Add license backup/restore functionality

### Phase 2: Automated Compliance Monitoring
- Background job checks compliance percentages
- Automatic suspension for non-payment
- Email notifications for compliance issues

### Phase 3: Smart Contract Enforcement
- Deploy licensing smart contract
- Automatic royalty collection on-chain
- Decentralized license registry

### Phase 4: Tiered Licensing
- Startup tier: 5% royalty, <$100k revenue
- Standard tier: 10% royalty, $100k-$1M revenue
- Enterprise tier: 15% royalty, >$1M revenue
- Custom agreements for large platforms

## Contact & Support

**Technical Support:** licensing@kenostod.academy
**Legal Inquiries:** legal@kenostod.academy
**API Documentation:** https://kenostod.academy/api-docs
**License Portal:** https://kenostod.academy/porv-licensing.html

---

**Document Version:** 1.0  
**Last Updated:** November 5, 2025  
**Technology:** Proof-of-Residual-Value (PoRV) Consensus System  
**Creator:** Kenostod Blockchain Academy  
**License Type:** Commercial License with Mandatory Profit-Sharing  
**Creator Royalty:** 10% of gross revenue
