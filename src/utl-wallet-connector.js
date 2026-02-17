import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { CoinbaseWalletSDK } from '@coinbase/wallet-sdk';

const BSC_CHAIN_ID = 56;
const BSC_RPC = 'https://bsc-dataseed1.binance.org/';

const UTL_CONTRACTS = {
  FeeCollector: '0xfE537c43d202C455Cedc141B882c808287BB662f',
  Staking: '0x49961979c93f43f823BB3593b207724194019d1d',
  Treasury: '0x3B3538b955647d811D42400084e9409e6593bE97',
  Distribution: '0xE6918cdBB9D8cd0d3532A88D974734B2F1A793c7',
  USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
};

class UTLWalletConnector {
  constructor() {
    this.provider = null;
    this.walletType = null;
    this.account = null;
    this.chainId = null;
    this._wcProvider = null;
    this._cbWallet = null;
  }

  detectAvailableWallets() {
    const wallets = [];

    if (typeof window.ethereum !== 'undefined') {
      if (window.ethereum.isMetaMask) {
        wallets.push({ id: 'metamask', name: 'MetaMask', icon: 'fa-brands fa-ethereum', available: true });
      }
      if (window.ethereum.isCoinbaseWallet || window.coinbaseWalletExtension) {
        wallets.push({ id: 'coinbase-extension', name: 'Coinbase Wallet', icon: 'fa-solid fa-coins', available: true });
      }
      if (!window.ethereum.isMetaMask && !window.ethereum.isCoinbaseWallet) {
        wallets.push({ id: 'injected', name: 'Browser Wallet', icon: 'fa-solid fa-wallet', available: true });
      }
    }

    wallets.push({ id: 'walletconnect', name: 'WalletConnect', icon: 'fa-solid fa-qrcode', available: true, description: 'Trust Wallet, Rainbow, 300+ wallets' });
    wallets.push({ id: 'coinbase-sdk', name: 'Coinbase Wallet', icon: 'fa-solid fa-coins', available: true, description: 'Mobile & Smart Wallet' });

    return wallets;
  }

  async connectMetaMask() {
    if (!window.ethereum || !window.ethereum.isMetaMask) {
      throw new Error('MetaMask is not installed. Please install MetaMask browser extension.');
    }

    await window.ethereum.request({ method: 'eth_requestAccounts' });
    await this._ensureBSCNetwork(window.ethereum);

    this.provider = window.ethereum;
    this.walletType = 'MetaMask';
    this.account = (await window.ethereum.request({ method: 'eth_accounts' }))[0];
    this.chainId = BSC_CHAIN_ID;

    this._setupListeners(window.ethereum);
    return { provider: this.provider, account: this.account, walletType: this.walletType };
  }

  async connectWalletConnect(projectId) {
    if (!projectId) {
      throw new Error('WalletConnect Project ID required. Get one free at cloud.walletconnect.com');
    }

    this._wcProvider = await EthereumProvider.init({
      projectId: projectId,
      chains: [BSC_CHAIN_ID],
      optionalChains: [BSC_CHAIN_ID],
      showQrModal: true,
      metadata: {
        name: 'UTL — Universal Transaction Layer',
        description: 'Asset-agnostic fee redistribution protocol on BNB Smart Chain',
        url: window.location.origin,
        icons: [`${window.location.origin}/utl-icon.png`]
      },
      rpcMap: {
        56: BSC_RPC
      }
    });

    await this._wcProvider.connect({ chains: [BSC_CHAIN_ID] });

    try {
      await this._wcProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x38' }]
      });
    } catch (e) {
      console.log('Chain switch after WC connect:', e.message);
    }

    this.provider = this._wcProvider;
    this.walletType = 'WalletConnect';
    this.account = this._wcProvider.accounts[0];
    this.chainId = BSC_CHAIN_ID;

    this._wcProvider.on('disconnect', () => {
      this.provider = null;
      this.account = null;
      this.walletType = null;
      if (this.onDisconnect) this.onDisconnect();
    });

    this._wcProvider.on('accountsChanged', (accounts) => {
      this.account = accounts[0];
      if (this.onAccountChanged) this.onAccountChanged(accounts[0]);
    });

    return { provider: this.provider, account: this.account, walletType: this.walletType };
  }

  async connectCoinbaseWallet() {
    this._cbWallet = new CoinbaseWalletSDK({
      appName: 'UTL — Universal Transaction Layer',
      appLogoUrl: `${window.location.origin}/utl-icon.png`
    });

    const cbProvider = this._cbWallet.makeWeb3Provider();

    const accounts = await cbProvider.request({ method: 'eth_requestAccounts' });
    await this._ensureBSCNetwork(cbProvider);

    this.provider = cbProvider;
    this.walletType = 'Coinbase Wallet';
    this.account = accounts[0];
    this.chainId = BSC_CHAIN_ID;

    this._setupListeners(cbProvider);
    return { provider: this.provider, account: this.account, walletType: this.walletType };
  }

  async connectInjected() {
    if (!window.ethereum) {
      throw new Error('No browser wallet detected. Please install MetaMask or Coinbase Wallet.');
    }

    await window.ethereum.request({ method: 'eth_requestAccounts' });
    await this._ensureBSCNetwork(window.ethereum);

    this.provider = window.ethereum;
    this.walletType = 'Browser Wallet';
    this.account = (await window.ethereum.request({ method: 'eth_accounts' }))[0];
    this.chainId = BSC_CHAIN_ID;

    this._setupListeners(window.ethereum);
    return { provider: this.provider, account: this.account, walletType: this.walletType };
  }

  async connect(walletId, options = {}) {
    switch (walletId) {
      case 'metamask':
        return this.connectMetaMask();
      case 'walletconnect':
        return this.connectWalletConnect(options.projectId);
      case 'coinbase-sdk':
      case 'coinbase-extension':
        return this.connectCoinbaseWallet();
      case 'injected':
        return this.connectInjected();
      default:
        throw new Error(`Unknown wallet: ${walletId}`);
    }
  }

  async disconnect() {
    if (this.walletType === 'WalletConnect' && this._wcProvider) {
      await this._wcProvider.disconnect();
    }
    this.provider = null;
    this.account = null;
    this.walletType = null;
    this.chainId = null;
  }

  isConnected() {
    return this.provider !== null && this.account !== null;
  }

  getContracts() {
    return UTL_CONTRACTS;
  }

  async _ensureBSCNetwork(provider) {
    const chainId = await provider.request({ method: 'eth_chainId' });
    if (parseInt(chainId, 16) !== BSC_CHAIN_ID) {
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x38' }]
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x38',
              chainName: 'BNB Smart Chain',
              nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
              rpcUrls: [BSC_RPC],
              blockExplorerUrls: ['https://bscscan.com/']
            }]
          });
        } else {
          throw switchError;
        }
      }
    }
  }

  _setupListeners(provider) {
    provider.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        this.provider = null;
        this.account = null;
        if (this.onDisconnect) this.onDisconnect();
      } else {
        this.account = accounts[0];
        if (this.onAccountChanged) this.onAccountChanged(accounts[0]);
      }
    });

    provider.on('chainChanged', (chainId) => {
      this.chainId = parseInt(chainId, 16);
      if (this.onChainChanged) this.onChainChanged(this.chainId);
    });
  }
}

window.UTLWalletConnector = UTLWalletConnector;
window.UTL_CONTRACTS = UTL_CONTRACTS;
