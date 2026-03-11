const EC = require('./secp256k1-compat').ec;
const ec = new EC('secp256k1');

class Wallet {
    constructor() {
        this.keyPair = ec.genKeyPair();
        this.publicKey = this.keyPair.getPublic('hex');
        this.privateKey = this.keyPair.getPrivate('hex');
    }

    static fromPrivateKey(privateKey) {
        const wallet = new Wallet();
        wallet.keyPair = ec.keyFromPrivate(privateKey, 'hex');
        wallet.publicKey = wallet.keyPair.getPublic('hex');
        wallet.privateKey = privateKey;
        return wallet;
    }

    getAddress() {
        return this.publicKey;
    }

    getPrivateKey() {
        return this.privateKey;
    }
}

module.exports = Wallet;