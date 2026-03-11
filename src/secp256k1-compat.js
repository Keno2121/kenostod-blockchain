/**
 * Drop-in replacement for elliptic (secp256k1 only)
 * Uses @noble/secp256k1 — audited, vulnerability-free
 */
const secp = require('@noble/secp256k1');

class KeyPair {
    constructor(privateKeyHex) {
        if (!privateKeyHex) {
            const privBytes = secp.utils.randomPrivateKey();
            this._privateKeyHex = Buffer.from(privBytes).toString('hex');
        } else {
            this._privateKeyHex = privateKeyHex;
        }
        const pubBytes = secp.getPublicKey(Buffer.from(this._privateKeyHex, 'hex'), false);
        this._publicKeyHex = Buffer.from(pubBytes).toString('hex');
    }

    getPublic(encoding) {
        return this._publicKeyHex;
    }

    getPrivate(encoding) {
        return this._privateKeyHex;
    }

    sign(hash, encoding) {
        const hashBuf = typeof hash === 'string'
            ? Buffer.from(hash.length === 64 ? hash : require('crypto').createHash('sha256').update(hash).digest('hex'), 'hex')
            : Buffer.from(hash);
        const sig = secp.signSync(hashBuf, Buffer.from(this._privateKeyHex, 'hex'));
        return {
            toDER: (enc) => {
                const derBytes = sig.toDERRawBytes();
                if (enc === 'hex') return Buffer.from(derBytes).toString('hex');
                return Array.from(derBytes);
            }
        };
    }

    verify(hash, signature) {
        try {
            const hashBuf = typeof hash === 'string'
                ? Buffer.from(hash.length === 64 ? hash : require('crypto').createHash('sha256').update(hash).digest('hex'), 'hex')
                : Buffer.from(hash);
            const sigBuf = typeof signature === 'string' ? Buffer.from(signature, 'hex') : Buffer.from(signature);
            const pubBuf = Buffer.from(this._publicKeyHex, 'hex');
            const sig = secp.Signature.fromDER(sigBuf);
            return secp.verify(sig, hashBuf, pubBuf);
        } catch (e) {
            return false;
        }
    }
}

class PublicKeyOnly {
    constructor(publicKeyHex) {
        this._publicKeyHex = publicKeyHex;
    }

    getPublic(encoding) {
        return this._publicKeyHex;
    }

    verify(hash, signature) {
        try {
            const hashBuf = typeof hash === 'string'
                ? Buffer.from(hash.length === 64 ? hash : require('crypto').createHash('sha256').update(hash).digest('hex'), 'hex')
                : Buffer.from(hash);
            const sigBuf = typeof signature === 'string' ? Buffer.from(signature, 'hex') : Buffer.from(signature);
            const pubBuf = Buffer.from(this._publicKeyHex, 'hex');
            const sig = secp.Signature.fromDER(sigBuf);
            return secp.verify(sig, hashBuf, pubBuf);
        } catch (e) {
            return false;
        }
    }
}

class EC {
    constructor(curve) {}

    genKeyPair() {
        return new KeyPair(null);
    }

    keyFromPrivate(hex, encoding) {
        return new KeyPair(hex);
    }

    keyFromPublic(hex, encoding) {
        return new PublicKeyOnly(hex);
    }
}

module.exports = { ec: EC };
