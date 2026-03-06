const { secp256k1 } = require('@noble/curves/secp256k1.js');

class Wallet {
    constructor() {
        const privKeyBytes = secp256k1.utils.randomSecretKey();
        this.privateKey = Buffer.from(privKeyBytes).toString('hex');
        this.publicKey = Buffer.from(secp256k1.getPublicKey(privKeyBytes, false)).toString('hex');
    }

    static fromPrivateKey(privateKey) {
        const wallet = Object.create(Wallet.prototype);
        wallet.privateKey = privateKey;
        wallet.publicKey = Buffer.from(
            secp256k1.getPublicKey(new Uint8Array(Buffer.from(privateKey, 'hex')), false)
        ).toString('hex');
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
