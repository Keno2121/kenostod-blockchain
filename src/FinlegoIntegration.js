const https = require('https');
const http = require('http');

const FINLEGO_CONFIG = {
  boBaseUrl: 'https://kanzum-bo.test-1.account.finlego.com',
  foBaseUrl: 'https://finlego-fo.test-1.account.finlego.com',
  vendorLogin: 'kanzum-vendor@local.com',
  vendorPassword: 'kanzum-vendor',
  clientLogin: 'John.Doe1@example.com',
  clientPassword: 'John.Doe1@example.com',
  apiPassword: 'czW97gwTx7pqM12',
};

let cachedToken = null;
let tokenExpiry = 0;

async function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')); });

    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function getAuthToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const authPayloads = [
    { url: `${FINLEGO_CONFIG.boBaseUrl}/api/auth/login`, body: { login: FINLEGO_CONFIG.vendorLogin, password: FINLEGO_CONFIG.vendorPassword } },
    { url: `${FINLEGO_CONFIG.boBaseUrl}/api/v1/auth/login`, body: { login: FINLEGO_CONFIG.vendorLogin, password: FINLEGO_CONFIG.vendorPassword } },
    { url: `${FINLEGO_CONFIG.boBaseUrl}/api/auth/token`, body: { username: FINLEGO_CONFIG.vendorLogin, password: FINLEGO_CONFIG.vendorPassword, grant_type: 'password' } },
    { url: `${FINLEGO_CONFIG.boBaseUrl}/oauth/token`, body: { username: FINLEGO_CONFIG.vendorLogin, password: FINLEGO_CONFIG.vendorPassword, grant_type: 'password' } },
  ];

  for (const payload of authPayloads) {
    try {
      const res = await httpRequest(payload.url, { method: 'POST' }, payload.body);
      if (res.status >= 200 && res.status < 300 && res.data) {
        const token = res.data.token || res.data.access_token || res.data.accessToken || res.data.jwt;
        if (token) {
          cachedToken = token;
          tokenExpiry = Date.now() + 50 * 60 * 1000;
          console.log('[Finlego] Auth token obtained via:', payload.url);
          return token;
        }
      }
    } catch (e) {
      // try next
    }
  }

  console.log('[Finlego] Could not obtain auth token — sandbox may require session cookies');
  return null;
}

async function getCardInfo(accountId) {
  const token = await getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const endpoints = [
    `${FINLEGO_CONFIG.boBaseUrl}/api/v1/accounts/${accountId || 'me'}/cards`,
    `${FINLEGO_CONFIG.boBaseUrl}/api/v1/cards`,
    `${FINLEGO_CONFIG.boBaseUrl}/api/cards`,
  ];

  for (const url of endpoints) {
    try {
      const res = await httpRequest(url, { headers });
      if (res.status >= 200 && res.status < 300 && res.data) {
        return { success: true, data: res.data };
      }
    } catch (e) {
      // try next
    }
  }

  return { success: false, sandbox: true, data: mockCardData() };
}

async function getBalance(accountId) {
  const token = await getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const endpoints = [
    `${FINLEGO_CONFIG.boBaseUrl}/api/v1/accounts/${accountId || 'me'}/balance`,
    `${FINLEGO_CONFIG.boBaseUrl}/api/v1/accounts/${accountId || 'me'}`,
    `${FINLEGO_CONFIG.boBaseUrl}/api/accounts/me`,
  ];

  for (const url of endpoints) {
    try {
      const res = await httpRequest(url, { headers });
      if (res.status >= 200 && res.status < 300 && res.data) {
        return { success: true, data: res.data };
      }
    } catch (e) {
      // try next
    }
  }

  return { success: false, sandbox: true, data: mockBalanceData() };
}

async function getTransactions(accountId, limit = 10) {
  const token = await getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const endpoints = [
    `${FINLEGO_CONFIG.boBaseUrl}/api/v1/accounts/${accountId || 'me'}/transactions?limit=${limit}`,
    `${FINLEGO_CONFIG.boBaseUrl}/api/v1/transactions?limit=${limit}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await httpRequest(url, { headers });
      if (res.status >= 200 && res.status < 300 && res.data) {
        return { success: true, data: res.data };
      }
    } catch (e) {
      // try next
    }
  }

  return { success: false, sandbox: true, data: mockTransactions() };
}

async function issueVirtualCard(userInfo) {
  const token = await getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const body = {
    firstName: userInfo.firstName || 'Student',
    lastName: userInfo.lastName || 'Member',
    email: userInfo.email,
    cardType: 'virtual',
    currency: 'USD',
    program: 'KUTL-EFI',
    metadata: {
      kenoBalance: userInfo.kenoBalance || 0,
      kenostodId: userInfo.userId,
    }
  };

  const endpoints = [
    `${FINLEGO_CONFIG.boBaseUrl}/api/v1/cards/issue`,
    `${FINLEGO_CONFIG.boBaseUrl}/api/v1/accounts/create`,
    `${FINLEGO_CONFIG.boBaseUrl}/api/cards`,
  ];

  for (const url of endpoints) {
    try {
      const res = await httpRequest(url, { method: 'POST', headers }, body);
      if (res.status >= 200 && res.status < 300 && res.data) {
        return { success: true, data: res.data };
      }
    } catch (e) {
      // try next
    }
  }

  return {
    success: false,
    sandbox: true,
    message: 'Card issuance queued — Finlego API connection pending Tuesday session',
    data: mockCardData(userInfo)
  };
}

function mockCardData(user = {}) {
  return {
    cardNumber: '**** **** **** 2026',
    cardHolder: user.firstName ? `${user.firstName} ${user.lastName}` : 'John Doe',
    expiryMonth: '03',
    expiryYear: '2028',
    cvv: '***',
    status: 'active',
    type: 'virtual',
    currency: 'USD',
    network: 'Mastercard',
    program: 'KUTL E-Fi Card',
    balance: 250.00,
    availableBalance: 250.00,
    spendingLimit: 5250.00,
    tier: 'Observer',
  };
}

function mockBalanceData() {
  return {
    available: 250.00,
    pending: 0,
    currency: 'USD',
    kenoBalance: 250,
    kenoValueUSD: 250.00,
    tier: 'Observer',
    coursesCompleted: 1,
    totalEarnedKENO: 250,
  };
}

function mockTransactions() {
  return [
    { id: 'tx001', date: new Date().toISOString(), description: 'Course 1 Completion Reward', amount: 250, currency: 'KENO', type: 'credit', status: 'completed' },
    { id: 'tx002', date: new Date(Date.now() - 86400000).toISOString(), description: 'Card Activation Bonus', amount: 10, currency: 'KENO', type: 'credit', status: 'completed' },
    { id: 'tx003', date: new Date(Date.now() - 172800000).toISOString(), description: 'UTL Staking Reward', amount: 3.75, currency: 'KENO', type: 'credit', status: 'completed' },
  ];
}

module.exports = {
  getAuthToken,
  getCardInfo,
  getBalance,
  getTransactions,
  issueVirtualCard,
  FINLEGO_CONFIG,
};
