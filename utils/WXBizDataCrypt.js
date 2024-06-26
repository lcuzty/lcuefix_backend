var Crypto = require('./cryptojs/cryptojs.js').Crypto;
// var app = getApp();
function WXBizDataCrypt(appId, sessionKey) {
    this.appId = appId
    this.sessionKey = sessionKey
}
WXBizDataCrypt.prototype.decryptData = function(encryptedData, iv) {
    // base64 decode ：使用 CryptoJS 中 Crypto.util.base64ToBytes()进行 base64解码
    var encryptedData = Crypto.util.base64ToBytes(encryptedData)
    // console.log(sessionKey)
    var key = Crypto.util.base64ToBytes(this.sessionKey);
    var iv = Crypto.util.base64ToBytes(iv);
    // console.log(encryptedData,key,iv)
    // 对称解密使用的算法为 AES-128-CBC，数据采用PKCS#7填充
    var mode = new Crypto.mode.CBC(Crypto.pad.pkcs7);
    try {
        // 解密
        var bytes = Crypto.AES.decrypt(encryptedData, key, {
            asBpytes: true,
            iv: iv,
            mode: mode
        });
        var decryptResult = JSON.parse(bytes);
 
    } catch (err) {
        console.log(err)
    }
    if (decryptResult.watermark.appid !== this.appId) {
        console.log(err)
    }
    return decryptResult
}
module.exports = WXBizDataCrypt