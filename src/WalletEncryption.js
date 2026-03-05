const crypto = require('crypto');

const _cipherKey = crypto.createHash('sha256')
    .update('kenostod-miner-wallet-v1-' + (process.env.REPL_ID || 'local'))
    .digest();

function encryptKey(hex) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', _cipherKey, iv);
    const enc = Buffer.concat([cipher.update(hex, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + enc.toString('hex');
}

function decryptKey(enc) {
    try {
        const [ivHex, dataHex] = enc.split(':');
        const decipher = crypto.createDecipheriv('aes-256-cbc', _cipherKey, Buffer.from(ivHex, 'hex'));
        return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
    } catch { return null; }
}

module.exports = { encryptKey, decryptKey };
