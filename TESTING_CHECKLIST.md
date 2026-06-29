# 🧪 Kenostod Platform Testing Checklist

## Overview
This comprehensive checklist helps you test all platform features before the November 18, 2025 private sale deadline.

---

## 🦊 Pre-Testing Setup

### MetaMask Configuration
- [ ] MetaMask installed in browser
- [ ] BSC (Binance Smart Chain) network added
  - Network Name: `Binance Smart Chain`
  - RPC URL: `https://bsc-dataseed.binance.org/`
  - Chain ID: `56` (mainnet) or `97` (testnet)
  - Symbol: `BNB`
- [ ] Test BNB available in wallet (minimum 0.1 BNB for testing)
- [ ] KENO token added to MetaMask
  - Contract: `0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E`

---

## 💰 ICO Campaign Testing

### 1. Landing Page (`/ico-campaign.html`)
**Countdown Timer:**
- [ ] Visit `/ico-campaign.html`
- [ ] Verify countdown timer is running
- [ ] Confirm it shows correct days/hours/minutes/seconds until Nov 18, 2025
- [ ] Timer updates every second
- [ ] After Nov 18, displays "PRIVATE SALE ENDED - Public Sale Dec 19"

**Visual Elements:**
- [ ] "PRIVATE SALE ENDING SOON - 20% BONUS" badge is pulsing
- [ ] Urgency messaging is clear and prominent
- [ ] CTA buttons link to `/ico.html`
- [ ] Stats section displays correctly

**Expected Results:**
- Timer shows accurate countdown
- All links work
- No console errors

---

### 2. Purchase Page (`/ico.html`)

**Wallet Connection:**
- [ ] Visit `/ico.html`
- [ ] Click "Connect Wallet" button
- [ ] MetaMask popup appears
- [ ] Approve connection
- [ ] Wallet address displays: `0xABC...XYZ` format
- [ ] BNB balance shows correctly

**Bonus Calculator:**
- [ ] Enter BNB amount (e.g., `0.5`)
- [ ] Green bonus calculator appears below input (before Nov 18 only)
- [ ] "Base Tokens" calculates correctly
- [ ] "20% Bonus" shows bonus tokens in gold
- [ ] "Total Value" = Base + Bonus
- [ ] "You save $X" displays USD savings vs public sale
- [ ] Calculation updates in real-time as you type
- [ ] After Nov 18 deadline, bonus calculator is hidden
- [ ] Bonus only shows if BOTH contract is in private mode AND date < Nov 18

**Purchase Flow:**
- [ ] Enter purchase amount (min: 0.01 BNB)
- [ ] "Buy KENO Tokens" button becomes enabled
- [ ] Click purchase button
- [ ] MetaMask popup shows transaction details
- [ ] Approve transaction
- [ ] Success message appears
- [ ] BSCScan link provided
- [ ] Transaction confirmed on blockchain
- [ ] Wallet balance updated

**Expected Results:**
- Bonus calculator shows 20% bonus during private sale
- Transaction completes successfully
- No errors in console

---

## 🌟 Wealth Builder Program Testing

### 3. Dashboard (`/wealth-builder.html`)

**Initial Connection:**
- [ ] Visit `/wealth-builder.html`
- [ ] "Connect MetaMask to Get Started" button visible
- [ ] Click connect button
- [ ] MetaMask popup appears
- [ ] Approve connection
- [ ] Button changes to "✅ Connected"
- [ ] Wallet address displays below button
- [ ] All stat cards populate with data

**Dashboard Stats:**
- [ ] "Total KENO Balance" displays correct amount
- [ ] "Course Rewards" shows KENO earned from courses
- [ ] "RVT Royalties" displays passive income
- [ ] "Referral Earnings" shows referral KENO
- [ ] "Courses Completed" count is accurate
- [ ] "Estimated Net Worth" calculates USD value

**Expected Results:**
- Smooth connection flow
- All stats load without errors
- Data is accurate based on wallet address

---

### 4. Course Completion Rewards

**Using Test Page (`/test-wealth-builder.html`):**
- [ ] Visit `/test-wealth-builder.html`
- [ ] Connect MetaMask wallet
- [ ] Select a course from dropdown (1-21)
- [ ] Click "Complete Course" button
- [ ] MetaMask signature request appears
- [ ] Sign the message
- [ ] Success message: "Course completed! 250 KENO credited"
- [ ] Dashboard updates automatically
- [ ] "Course Rewards" increases by 250 KENO
- [ ] "Courses Completed" count increments

**Duplicate Prevention:**
- [ ] Try completing the same course twice
- [ ] Should receive error: "Already completed this course"
- [ ] No duplicate reward given

**Rate Limiting:**
- [ ] Try completing 11 courses rapidly
- [ ] 11th attempt should be rate limited
- [ ] Error message explains rate limit (10/hour)

**Security Validation:**
- [ ] Try submitting without signature (should fail)
- [ ] Try with expired timestamp (5+ minutes old, should fail)
- [ ] Try with future timestamp (>1 minute ahead, should fail)
- [ ] Try with tampered timestamp (modified after signing, should fail)
- [ ] Try with invalid wallet address (should fail)
- [ ] Test server clock drift tolerance (timestamp within acceptable range)
- [ ] Verify EIP-191 signature format compatibility with MetaMask

**Expected Results:**
- 250 KENO credited per course
- Anti-fraud protection works
- Rate limiting prevents abuse

---

### 5. RVT NFT Milestones

**Achievement Testing:**
- [ ] Complete 5 courses
- [ ] Check "RVT NFTs" tab
- [ ] Verify Bronze RVT NFT appears (0.25% royalties)
- [ ] Complete 10 courses total
- [ ] Verify Silver RVT NFT appears (0.50% royalties)
- [ ] Complete 16 blockchain courses
- [ ] Verify Gold RVT NFT appears (1.00% royalties)
- [ ] Complete all 21 courses
- [ ] Verify Platinum RVT NFT appears (2.00% royalties)

**NFT Display:**
- [ ] Each NFT shows tier (Bronze/Silver/Gold/Platinum)
- [ ] Royalty percentage is correct
- [ ] Courses milestone is accurate
- [ ] Visual distinction between tiers

**Expected Results:**
- NFTs awarded at correct milestones
- No duplicate NFTs
- Royalty percentages are accurate

---

### 6. Scholarship Applications

**Application Submission:**
- [ ] Go to "Scholarships" tab
- [ ] Fill out application form:
  - Full Name
  - Email
  - Country
  - Education Level
  - Financial Need (detailed explanation)
- [ ] Click "Submit Application"
- [ ] MetaMask signature request appears
- [ ] Sign the message
- [ ] Success message appears
- [ ] Application ID displayed

**Rate Limiting:**
- [ ] Try submitting 4 applications in one day
- [ ] 4th attempt should be rate limited
- [ ] Error: "Maximum 3 applications per day"

**Duplicate Prevention:**
- [ ] Application status should prevent resubmission until reviewed

**Expected Results:**
- Application submits successfully
- Signature authentication works
- Rate limiting prevents spam

---

### 7. Job Applications

**Viewing Job Listings:**
- [ ] Go to "Career Center" tab
- [ ] Job listings display with:
  - Job title
  - Company name
  - Salary range
  - Location/remote status
  - Description
  - Requirements

**Applying for Jobs:**
- [ ] Click "Apply Now" on a job
- [ ] Fill out application:
  - Cover letter
  - Resume/LinkedIn URL
- [ ] Click "Submit Application"
- [ ] MetaMask signature request appears
- [ ] Sign the message
- [ ] Success message appears
- [ ] Button changes to "Applied"

**Duplicate Prevention:**
- [ ] Try applying to same job twice
- [ ] Error: "Already applied to this job"

**Rate Limiting:**
- [ ] Try applying to 21 jobs in one day
- [ ] 21st attempt should be rate limited
- [ ] Error: "Maximum 20 applications per day"

**Expected Results:**
- Job applications submit successfully
- No duplicate applications
- Rate limiting works

---

### 8. Referral System

**Generating Referral Code:**
- [ ] Go to "Referrals" tab
- [ ] Referral code automatically generated
- [ ] Code format: `KENO-{wallet_prefix}`
- [ ] Copy button works

**Using Referral Code:**
- [ ] Open new browser/incognito window
- [ ] Connect different MetaMask wallet
- [ ] Visit Wealth Builder with referral parameter: `/wealth-builder.html?ref=KENO-ABC123`
- [ ] Complete a course
- [ ] Original referrer earns bonus KENO

**Referral Stats:**
- [ ] "Total Referrals" count is accurate
- [ ] "Referral Earnings" shows KENO earned
- [ ] Referral history displays referred wallets

**Rate Limiting:**
- [ ] Try processing 51 referrals in one day
- [ ] 51st should be rate limited
- [ ] Error: "Maximum 50 referrals per day"

**Expected Results:**
- Referral code generates correctly
- Referrals tracked accurately
- Rewards distributed properly

---

## 🔒 Security Testing

### Authentication & Signatures

**Valid Signature:**
- [ ] All POST requests include MetaMask signature
- [ ] Server verifies signature using ethers.js
- [ ] Signature includes timestamp
- [ ] Signature includes action name
- [ ] Signature includes wallet address

**Invalid Signature:**
- [ ] Submit request with wrong signature → 401 Unauthorized
- [ ] Submit request with no signature → 400 Bad Request
- [ ] Submit request with expired timestamp (>5 min) → 401 Expired

**Replay Attack Protection:**
- [ ] Capture a valid signed request
- [ ] Wait 6 minutes
- [ ] Replay the request
- [ ] Should fail with "Signature expired"

**Expected Results:**
- All requests authenticated
- Invalid/expired signatures rejected
- Replay attacks prevented

---

### Rate Limiting

**Per-Endpoint Limits:**
- [ ] Course completions: 10/hour per IP
- [ ] Scholarships: 3/day per IP
- [ ] Job applications: 20/day per IP
- [ ] Referrals: 50/day per IP

**Testing:**
- [ ] Exceed each limit
- [ ] Verify 429 Too Many Requests error
- [ ] Error message explains limit
- [ ] Wait for reset period
- [ ] Verify limit resets correctly

**Expected Results:**
- Rate limits enforced
- Clear error messages
- Limits reset as expected

---

## 📊 Database Integrity

### Data Persistence

**Course Progress:**
- [ ] Complete a course
- [ ] Close browser
- [ ] Reopen and reconnect wallet
- [ ] Course completion persists
- [ ] Cannot claim reward again

**Scholarship Applications:**
- [ ] Submit application
- [ ] Refresh page
- [ ] Application status displays
- [ ] Cannot resubmit until reviewed

**Job Applications:**
- [ ] Apply to job
- [ ] Refresh page
- [ ] "Applied" status persists
- [ ] Cannot apply again

**Expected Results:**
- All data persists correctly
- No duplicate entries
- UNIQUE constraints enforced

---

## 🎯 User Experience Testing

### Cross-Browser Compatibility
- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Edge (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (mobile)

### Responsive Design
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

### Performance
- [ ] Page loads under 3 seconds
- [ ] MetaMask connects under 2 seconds
- [ ] Signature requests appear under 1 second
- [ ] Dashboard updates smoothly
- [ ] No lag or freezing

**Expected Results:**
- Works on all browsers
- Responsive on all screen sizes
- Fast and smooth performance

---

## 🚨 Edge Cases & Error Handling

### Wallet Issues
- [ ] MetaMask not installed → Clear error message
- [ ] User rejects connection → Graceful failure
- [ ] User switches wallets → Dashboard updates
- [ ] User disconnects wallet → Returns to connect screen
- [ ] Wrong network (not BSC) → Prompts to switch

### Network Issues
- [ ] Offline → Error message displayed
- [ ] Slow connection → Loading indicators
- [ ] Failed transaction → Error with retry option
- [ ] RPC timeout → Fallback RPC or error

### Invalid Inputs
- [ ] Empty form fields → Validation errors
- [ ] Invalid course ID (e.g., 99) → Error: "Invalid course"
- [ ] Negative numbers → Validation error
- [ ] SQL injection attempts → Sanitized and blocked

**Expected Results:**
- Graceful error handling
- Clear user feedback
- No crashes or white screens

---

## ✅ Pre-Launch Checklist

### Final Verification
- [ ] All 21 courses have completion rewards
- [ ] All 4 RVT NFT tiers award correctly
- [ ] Scholarship fund has balance
- [ ] Job listings are live and accurate
- [ ] Referral system tracks correctly
- [ ] All rate limits are production-ready
- [ ] Database backups configured
- [ ] SSL/HTTPS enabled
- [ ] Environment variables secured
- [ ] Error logging active

### Documentation
- [ ] User guide available
- [ ] API documentation complete
- [ ] Security audit passed
- [ ] Privacy policy published
- [ ] Terms of service published

### Monitoring
- [ ] Server uptime monitoring active
- [ ] Database performance monitored
- [ ] Error tracking enabled
- [ ] User analytics configured

**Expected Results:**
- Platform 100% production-ready
- All features working flawlessly
- Security hardened
- Documentation complete

---

## 🐛 Bug Tracking Template

If you find issues during testing, document them:

**Bug Title:**
**Severity:** Critical / High / Medium / Low
**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**

**Actual Behavior:**

**Screenshots:**

**Browser/Device:**

**Console Errors:**

---

## 📈 Success Metrics

After testing, verify:
- [ ] 0 critical bugs
- [ ] 100% authentication success rate
- [ ] <1% transaction failure rate
- [ ] <2 second average response time
- [ ] 0 security vulnerabilities
- [ ] 100% mobile responsiveness

---

## 🎉 Testing Complete!

When all items are checked:
1. ✅ Platform is production-ready
2. ✅ ICO can launch safely
3. ✅ Users can earn rewards securely
4. ✅ Wealth Builder Program fully operational

**Last Updated:** November 13, 2025
**Next Review:** Before Nov 18 Private Sale Launch
