const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DASHBOARD_FILE = path.join(DATA_DIR, 'soe_dashboard.json');

function defaultData() {
  return {
    lastUpdated: null,
    health: {
      liquidity: { total: null, target: null, status: 'red' },
      volume: { dailyAverage: null, target: null, status: 'red' },
      slippage: { ammAverage: null, target: 1.5, status: 'red' },
    },
    liquidity: {
      pancakeswap: { depth: null, target: null, status: 'red', pct: null },
      raydium: { depth: null, target: null, status: 'red', pct: null },
      hyperliquid: { depth: null, target: null, status: 'red', pct: null },
      aster: { depth: null, target: null, status: 'red', pct: null },
    },
    volume: {
      today: { date: null, dailyVolume: null, tradeCount: null, topSource: null, buySellRatio: null },
      bySource: {
        falArbitrage: null,
        crossPlatformArb: null,
        organicTrading: null,
        temporalTaxonomyRebates: null,
        aegisTaxRedistribution: null,
        academyIncentives: null,
        merchantGateway: null,
        utlFarmCompounding: null,
      },
    },
    slippage: {
      under1k: { ammSlippage: null, orderBookSpread: null, efficiency: null, status: 'red' },
      from1kTo10k: { ammSlippage: null, orderBookSpread: null, efficiency: null, status: 'red' },
      from10kTo50k: { ammSlippage: null, orderBookSpread: null, efficiency: null, status: 'red' },
      over50k: { orderBookSpread: null, efficiency: null, status: 'red' },
    },
    marketMaker: {
      revenueShareAPR: null,
      rebalancingCost: null,
      inventoryTurnover: null,
      twal: null,
      toxicFlowRatio: null,
    },
    ilp: {
      fundSize: null,
      fundTarget: null,
      lpRetentionRate: null,
      avgStakingDurationDays: null,
      claimsFiled: null,
      claimsPaid: null,
      lpSatisfaction: null,
    },
    ecosystem: {
      uniqueActiveWallets: null,
      kenoBurnedMonthly: null,
      kenoGenesisMinted: null,
      kenoGenesisTotal: 6174,
      queensChariotMinted: null,
      queensChariotTotal: 1729,
      kingsShieldMinted: null,
      kingsShieldTotal: 617,
      houses: {
        academy: null,
        farm: null,
        arbitrage: null,
        card: null,
        security: null,
        apparel: null,
        bunker: null,
      },
    },
    alerts: {
      notes: [],
    },
    weeklyReports: [],
    resources: {
      website: 'https://kenostodblockchain.com',
      kingsShield: 'https://kings-shield.com',
      pinksale: 'https://www.pinksale.finance/launchpad/bsc/0x92d69213842Ee84b47221Cbba299e01853fccF2d',
      empiricaOutreach: '',
      soeDocument: '',
      vlatDocument: '',
    },
    team: [],
  };
}

class SoeDashboardStore {
  constructor() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DASHBOARD_FILE)) {
      this._write(defaultData());
    }
    if (this.load().team.length === 0) {
      this._seedTeam();
    }
  }

  _seedTeam() {
    const data = this.load();
    data.team = [
      { name: 'Founder', role: 'founder', permission: 'full', token: null },
      { name: 'Patience', role: 'moderator', permission: 'weekly_report', token: crypto.randomBytes(16).toString('hex') },
      { name: 'Developer', role: 'developer', permission: 'alerts', token: crypto.randomBytes(16).toString('hex') },
      { name: 'Empirica', role: 'market_maker', permission: 'view_only', token: crypto.randomBytes(16).toString('hex') },
    ];
    this._write(data);
  }

  load() {
    try {
      return JSON.parse(fs.readFileSync(DASHBOARD_FILE, 'utf8'));
    } catch (e) {
      const fresh = defaultData();
      this._write(fresh);
      return fresh;
    }
  }

  _write(data) {
    fs.writeFileSync(DASHBOARD_FILE, JSON.stringify(data, null, 2));
  }

  getRoleByToken(token) {
    if (!token) return null;
    const data = this.load();
    return data.team.find(t => t.token && t.token === token) || null;
  }

  update(section, payload) {
    const data = this.load();
    if (!data[section]) throw new Error(`Unknown dashboard section: ${section}`);
    data[section] = { ...data[section], ...payload };
    data.lastUpdated = new Date().toISOString();
    this._write(data);
    return data;
  }

  addWeeklyReport(report) {
    const data = this.load();
    data.weeklyReports.unshift({ ...report, createdAt: new Date().toISOString() });
    data.weeklyReports = data.weeklyReports.slice(0, 52);
    data.lastUpdated = new Date().toISOString();
    this._write(data);
    return data;
  }

  addAlertNote(note, level) {
    const data = this.load();
    data.alerts.notes.unshift({ note, level, at: new Date().toISOString() });
    data.alerts.notes = data.alerts.notes.slice(0, 100);
    data.lastUpdated = new Date().toISOString();
    this._write(data);
    return data;
  }

  regenerateToken(role) {
    const data = this.load();
    const member = data.team.find(t => t.role === role);
    if (!member) throw new Error(`Unknown role: ${role}`);
    member.token = crypto.randomBytes(16).toString('hex');
    this._write(data);
    return member;
  }
}

const PERMISSION_SECTIONS = {
  full: ['health', 'liquidity', 'volume', 'slippage', 'marketMaker', 'ilp', 'ecosystem', 'alerts', 'weeklyReports', 'resources', 'team'],
  weekly_report: ['weeklyReports'],
  alerts: ['alerts'],
  view_only: [],
};

module.exports = { SoeDashboardStore, PERMISSION_SECTIONS, defaultData };
