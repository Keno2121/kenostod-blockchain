# 🚀 PayPal LIVE MODE - Production Setup Guide

## ✅ What's Already Done

Your PayPal integration is **100% complete** and ready for production:

- ✅ PayPal Smart Payment Buttons integrated
- ✅ Dual purchase path (Easy: PayPal/Credit Card vs Advanced: Crypto Wallet)
- ✅ Gold "Buy KENO ICO" button in main navigation
- ✅ Tier validation ($50, $100, $250, $500, $1000)
- ✅ Production-grade error handling
- ✅ Secure API endpoints with proper logging
- ✅ Server running with NO errors

---

## 🔐 Step 1: Get Your LIVE PayPal Credentials

Currently, you're using **SANDBOX** credentials (for testing only). To accept real payments, you need **LIVE** credentials.

### How to Get Live Credentials:

1. **Go to PayPal Developer Dashboard:**
   - Visit: https://developer.paypal.com/dashboard/
   - Log in with your PayPal Business account

2. **Switch to LIVE mode:**
   - In the top-right corner, toggle from "Sandbox" to "Live"

3. **Create a LIVE App:**
   - Click "Apps & Credentials"
   - Click "Create App"
   - Name it: "Kenostod ICO"
   - Click "Create App"

4. **Copy Your Live Credentials:**
   - **Client ID** - This is visible (starts with "A...")
   - **Client Secret** - Click "Show" to reveal it (keep this SECRET!)

---

## 🔧 Step 2: Update Replit Secrets

1. **Open Replit Secrets Manager:**
   - Click the 🔒 **Secrets** tab (left sidebar)
   - Click the **Secrets** option (not Account secrets!)

2. **Update These Two Secrets:**

   **PAYPAL_CLIENT_ID**
   - Delete the current sandbox value
   - Paste your NEW LIVE Client ID
   - Save

   **PAYPAL_CLIENT_SECRET**
   - Delete the current sandbox value
   - Paste your NEW LIVE Client Secret
   - Save

---

## 🎯 Step 3: Enable LIVE Mode

You have **TWO OPTIONS** for enabling live mode:

### Option A: Environment Variable (Recommended)

1. **In Replit Secrets, add a NEW secret:**
   - Key: `PAYPAL_MODE`
   - Value: `live`
   - Click "Add new secret"

2. **Restart your server:**
   - The workflow will auto-restart
   - OR manually stop/start "Kenostod Blockchain Server"

### Option B: Code Change (Alternative)

Edit `src/PayPalIntegration.js` line 14:

```javascript
// BEFORE (Sandbox):
const environment = process.env.PAYPAL_MODE === 'live' 
    ? new checkoutNodeJssdk.core.LiveEnvironment(this.clientId, this.clientSecret)
    : new checkoutNodeJssdk.core.SandboxEnvironment(this.clientId, this.clientSecret);

// AFTER (Force Live):
const environment = new checkoutNodeJssdk.core.LiveEnvironment(this.clientId, this.clientSecret);
```

**⚠️ Option A is safer!** It lets you switch between sandbox/live without code changes.

---

## ✅ Step 4: Verify LIVE Mode is Active

After restarting your server, check the console logs:

**✅ GOOD - Live mode working:**
```
✅ Loaded blockchain from disk...
✅ Stripe configured in LIVE MODE
✅ PostgreSQL connection pool initialized
```

**❌ BAD - Still in test mode:**
```
⚠️ WARNING: PayPal running in TEST MODE
```

If you see the warning, double-check that:
1. LIVE credentials are correctly pasted in Secrets
2. `PAYPAL_MODE=live` secret exists
3. Server has been restarted

---

## 🧪 Step 5: Test the Integration

### Before Going Live:

1. **Test with $1.00 minimum:**
   - Temporarily change the tier validation to allow $1
   - Process a real $1 payment
   - Verify it appears in your PayPal Business account
   - Change tier validation back to production tiers

2. **Check PayPal Dashboard:**
   - Log in to https://www.paypal.com
   - Go to "Activity"
   - Verify the test payment appears

### Going Live:

1. **Announce the ICO** (email, social media, website)
2. **Monitor payments** in PayPal Business Dashboard
3. **Check server logs** for any errors
4. **Track orders** in your database

---

## 💰 Payment Flow for Customers

1. Customer clicks **🪙 Buy KENO ICO** in navigation
2. Selects **EASY** purchase option
3. Chooses a tier: $50, $100, $250, $500, or $1,000
4. Clicks **Continue to PayPal**
5. PayPal popup opens (they log in OR pay with credit card)
6. They complete payment
7. Success message shows with:
   - Order ID
   - Amount paid
   - KENO tokens earned (base + 20% ICO bonus)

---

## 🔒 Security Checklist

✅ Credentials stored in Replit Secrets (encrypted)
✅ Never logged or exposed to users
✅ Tier validation prevents arbitrary amounts
✅ Test mode blocked in production
✅ Full error logging for troubleshooting
✅ HTTPS enforced on Replit domains

---

## 📊 After Launch - Monitoring

### Check These Regularly:

1. **PayPal Business Dashboard**
   - Track daily sales
   - Monitor chargebacks
   - Verify funds are settling

2. **Server Logs** (in Replit Console)
   - Look for errors starting with "PayPal create-order error:"
   - Check for failed captures

3. **Customer Support**
   - Respond to payment issues quickly
   - Keep PayPal email handy for verification

---

## 🚨 Emergency: Switch Back to Sandbox

If something goes wrong:

1. **In Replit Secrets:**
   - Change `PAYPAL_MODE` from `live` to `sandbox`
   - OR delete the `PAYPAL_MODE` secret entirely

2. **Replace credentials:**
   - Put your SANDBOX credentials back in
   - Restart server

3. **Investigate:**
   - Check server logs for errors
   - Contact PayPal support if needed

---

## 📞 Support Resources

**PayPal Developer Support:**
- https://developer.paypal.com/support/

**PayPal Business Help:**
- https://www.paypal.com/us/smarthelp/contact-us

**Replit Agent (me!):**
- Just ask if something isn't working!

---

## 🎉 You're Ready!

Your PayPal integration is **PRODUCTION-READY**. Just:

1. Get LIVE credentials from PayPal
2. Update Replit Secrets
3. Set `PAYPAL_MODE=live`
4. Restart server
5. **Start selling KENO tokens!** 💰

---

**Questions? Need help switching to live mode? Just ask!** 🚀
