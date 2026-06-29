# 🚀 Kenostod Blockchain - Deployment Guide

## Quick Deploy to Replit (Recommended)

Your Kenostod blockchain is **ready to deploy** right now! Follow these simple steps:

### Step 1: Click Deploy
1. Look at the top of your Replit workspace
2. Click the **"Deploy"** button (or **"Publish"** button)
3. A deployment configuration window will open

### Step 2: Configure Deployment
1. **Deployment Type**: Select **"Autoscale"**
   - Autoscale is perfect for blockchain applications
   - Scales automatically based on traffic
   - Cost-efficient (scales down to zero when idle)

2. **CRITICAL: Set Environment Variable**:
   - In deployment settings, find "Environment Variables" or "Secrets"
   - Add: `NODE_ENV` = `production`
   - **This is REQUIRED** to disable development-only endpoints that accept private keys
   - Without this, the deployment will NOT be secure!

3. **Review Settings**:
   - **Run Command**: `node server.js` (already configured ✅)
   - **Port**: 5000 (already configured ✅)
   - **Environment Variable**: `NODE_ENV=production` (REQUIRED ✅)

4. Click **"Deploy"** or **"Publish"**

### Step 3: Get Your Public URL
1. After deployment completes (usually 1-2 minutes), you'll receive a public URL
2. Your blockchain will be accessible at: `https://your-project-name.repl.co`
3. Anyone can access your blockchain from anywhere in the world! 🌍

### Step 4: Test Your Deployment
Visit these URLs to verify everything works:

- **Main Interface**: `https://your-deployment.repl.co/` (has library loading issues, use API instead)
- **API Documentation**: `https://your-deployment.repl.co/docs.html` ✅
- **API Test**: `https://your-deployment.repl.co/api/chain` ✅

**⚠️ DO NOT USE** in production deployment:
- `/test.html` - Development only, disabled in production
- `/api/transaction/simple` - Will return 403 Forbidden if NODE_ENV is set correctly

## Custom Domain (Optional)

Want a custom domain like `kenostod.com`? Here's how:

### Option 1: Free Replit Subdomain
- Your deployment automatically gets a free `.repl.co` subdomain
- Example: `kenostod-blockchain.repl.co`
- No setup required!

### Option 2: Custom Domain ($10-15/year)
1. **Purchase a domain** from:
   - Namecheap (~$10/year)
   - Porkbun (~$10/year)
   - Cloudflare (~$10/year)
   - GoDaddy (~$15/year)

2. **Configure DNS** (in your domain provider):
   - Add a CNAME record pointing to your Replit deployment URL
   - Wait 5-60 minutes for DNS propagation

3. **Link in Replit**:
   - In your deployment settings, click "Add Custom Domain"
   - Enter your domain name
   - Follow the verification steps

## What Gets Deployed?

✅ **Full Blockchain System**
- Complete blockchain with proof-of-work mining
- All 30+ REST API endpoints
- Web interface with all revolutionary features

✅ **Six Revolutionary Features**
1. Transaction Reversal Window (5 minutes)
2. Smart Scheduled Payments
3. Social Recovery System
4. Transaction Messages
5. Reputation System
6. Community Governance

✅ **Security Features**
- CORS enabled for cross-origin requests
- Client-side transaction signing (private keys never sent to server)
- Digital signature verification
- Chain integrity validation

## API Endpoints

Your deployed blockchain includes these endpoints:

### Blockchain
- `GET /api/chain` - Get entire blockchain
- `GET /api/chain/latest` - Get latest block
- `GET /api/chain/height` - Get blockchain height
- `GET /api/valid` - Check blockchain validity
- `GET /api/supply` - Get token supply info

### Transactions (Production)
- `POST /api/transaction` - Submit pre-signed transaction (requires client-side signing)
- `GET /api/balance/:address` - Check wallet balance
- `GET /api/transactions/:address` - Get transaction history
- `GET /api/pending/:address` - View pending transactions
- `POST /api/transaction/cancel` - Cancel pending transaction

### Development-Only Transactions (Disabled in Production)
- `POST /api/transaction/simple` - ⚠️ DEV ONLY - Server-side signing (returns 403 in production)
- `POST /api/sign` - ⚠️ DEV ONLY - Sign helper (returns 403 in production)

### Scheduled Payments
- `POST /api/scheduled/create` - Create scheduled payment
- `GET /api/scheduled/:address` - View scheduled payments
- `POST /api/scheduled/cancel` - Cancel scheduled payment

### Social Recovery
- `POST /api/recovery/setup` - Set up guardians
- `POST /api/recovery/initiate` - Start recovery process
- `POST /api/recovery/approve` - Approve recovery (as guardian)
- `GET /api/recovery/:address` - View recovery setup

### Reputation
- `POST /api/reputation/rate` - Rate a transaction/user
- `GET /api/reputation/:address` - Get reputation score

### Governance
- `POST /api/governance/propose` - Create proposal
- `POST /api/governance/vote` - Vote on proposal
- `GET /api/governance/proposals` - View all proposals
- `GET /api/governance/proposal/:id` - View specific proposal

### Mining
- `POST /api/mine` - Mine a block
- `GET /api/difficulty` - Get mining difficulty

## Performance & Scaling

### Autoscale Deployment
- **Automatic scaling**: Handles 1-10,000+ requests/minute
- **Zero downtime**: Scales up instantly when traffic increases
- **Cost efficient**: Scales down to zero when idle
- **Global CDN**: Fast worldwide access

### Resource Usage
- **Memory**: ~50-100MB base, scales as needed
- **CPU**: Minimal when idle, increases during mining
- **Storage**: Blockchain data stored in memory (resets on restart)

## Monitoring Your Deployment

### Check Deployment Status
1. Go to Replit dashboard
2. Click on "Deployments" tab
3. View:
   - Deployment status (Running/Stopped)
   - Request count
   - Response times
   - Error logs

### View Logs
- Click "Logs" in deployment settings
- See all API requests and blockchain activity
- Monitor mining operations
- Debug issues

## Pricing

### Replit Autoscale
- **Free Tier**: Limited requests/month
- **Paid Plans**: 
  - Cycles: Pay-as-you-go for compute time
  - Static deployment: ~$7-15/month
  - Autoscale: Starts at $0, scales with usage

### Custom Domain
- ~$10-15/year for domain registration
- Free SSL certificate included with Replit

## Security Best Practices

### Critical Security Notice

⚠️ **IMPORTANT:** The following endpoints accept private keys and are **DISABLED in production**:
- `POST /api/transaction/simple`
- `POST /api/sign`

These endpoints are for development/testing ONLY and will return 403 Forbidden errors when `NODE_ENV=production`.

**For Production Transactions:**
- Users MUST sign transactions client-side (never send private keys to server)
- Use the standard `/api/transaction` endpoint with pre-signed transactions
- The main web interface (index.html) attempts client-side signing but has library loading issues in some environments

### For Production Use
1. **Set NODE_ENV=production** to disable development endpoints
2. **Use Environment Variables** for any secrets
3. **Enable HTTPS** (automatic with Replit deployment)
4. **Monitor Logs** regularly for suspicious activity
5. **Rate Limiting**: Consider adding rate limiting for API endpoints
6. **Backup Data**: Blockchain resets on server restart (consider persistent storage)
7. **Client-Side Signing**: Ensure users sign transactions locally before submitting

### For Users
1. **NEVER share private keys** with anyone or any server
2. **Test with small amounts** first
3. **Use the reversal window** if you make a mistake
4. **Set up social recovery** as a backup
5. **Be cautious** with the test interface (/test.html) - it's for development only

## Testing Your Deployment

### Production Deployment Verification (API-based)

After deploying with NODE_ENV=production, verify the deployment using these curl commands:

```bash
# Replace YOUR_URL with your deployment URL

# 1. Check blockchain status
curl https://YOUR_URL.repl.co/api/chain

# 2. Check supply information
curl https://YOUR_URL.repl.co/api/supply

# 3. Verify blockchain validity
curl https://YOUR_URL.repl.co/api/valid

# 4. Verify dev endpoints are disabled (should return 403 Forbidden)
curl -X POST https://YOUR_URL.repl.co/api/transaction/simple

# Expected response: {"error":"This endpoint is disabled in production for security reasons"...}
```

### Pre-Production Testing (Development Mode Only)

**⚠️ IMPORTANT:** The following tests ONLY work when NODE_ENV is NOT set to production (e.g., local development):

1. Visit `https://YOUR_URL.repl.co/test.html` (will show but endpoints will fail in production)
2. Click "Mine Block" to get KENO (requires dev mode)
3. Send a transaction (requires dev mode)
4. Cancel it within 5 minutes (this works in production)
5. Verify balance didn't change

**Note:** In production deployment, /test.html will load but transaction sending will fail with 403 errors. This is expected and correct security behavior.

## Troubleshooting

### Deployment Failed
- Check logs for error messages
- Verify `node server.js` runs locally
- Ensure all dependencies are in `package.json`
- Try redeploying

### API Not Responding
- Check deployment status (should be "Running")
- Verify the URL is correct
- Check CORS settings for cross-origin requests
- Review error logs

### Blockchain Resets
- This is normal! Blockchain data is in-memory
- For persistence, consider adding database storage
- Use Replit's persistent storage options

## Next Steps

### Enhance Your Blockchain
1. **Add Persistent Storage**: Use Replit database or PostgreSQL
2. **Implement Rate Limiting**: Protect against abuse
3. **Add Analytics**: Track usage and performance
4. **Create Mobile App**: Use the API endpoints
5. **Add More Features**: Build on the revolutionary foundation

### Share Your Blockchain
1. Share your deployment URL on social media
2. Create a demo video showing the revolutionary features
3. Write documentation for developers
4. Build a community around Kenostod

## Support

### Need Help?
- Check the API documentation: `/docs.html` ✅
- Use curl or API tools to test production deployment
- Test features in development mode before deploying to production
- Monitor deployment logs for security warnings and issues

## Congratulations! 🎉

You've deployed a revolutionary blockchain with features that Bitcoin, Ethereum, and Solana don't have:

✅ Transaction Reversal Window
✅ Smart Scheduled Payments
✅ Social Recovery System
✅ Transaction Messages
✅ Reputation System
✅ Community Governance

Your blockchain is now live and accessible to the world! 🌍
