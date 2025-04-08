import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

export default class CryptoHelper {
    static encrypt = (text) => {
        const iv = crypto.randomBytes(16); 
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
    
        return { encryptedData: encrypted, iv: iv.toString('hex'), authTag, hash: this.hashKey(text) };
    }
    
    static decrypt = ({ encryptedData, iv, authTag }) => {
        const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
    
        return decrypted;
    }

    static generateHashedKey = _ => {
        const key = crypto.randomBytes(64).toString('hex')
        return { hash: this.hashKey(key), key};
    }

    static hashKey = (key) => crypto
        .createHmac('sha256', process.env.HASH_SECRET)
        .update(key)
        .digest('hex');
}
