const crypto = require('crypto');

// 藍新金流 MPG 參數建立
// 文件：https://www.newebpay.com/website/Page/content/download_api
// TODO: 待填入正式商店資訊後啟用

const MERCHANT_ID = process.env.NEWEBPAY_MERCHANT_ID || '';
const HASH_KEY = process.env.NEWEBPAY_HASH_KEY || '';
const HASH_IV = process.env.NEWEBPAY_HASH_IV || '';
const API_URL = process.env.NEWEBPAY_API_URL || 'https://ccore.newebpay.com/MPG/mpg_gateway';

function aesEncrypt(data) {
  const cipher = crypto.createCipheriv('aes-256-cbc', HASH_KEY, HASH_IV);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function sha256Hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
}

/**
 * 建立藍新金流付款參數
 * @param {object} order - { order_no, total_price, title, email }
 * @returns {{ apiUrl, merchantId, tradeInfo, tradeSha, version }}
 */
function buildPaymentParams(order) {
  if (!MERCHANT_ID || !HASH_KEY || !HASH_IV) {
    // 尚未設定藍新金流參數
    return null;
  }

  const tradeData = new URLSearchParams({
    MerchantID: MERCHANT_ID,
    RespondType: 'JSON',
    TimeStamp: Math.floor(Date.now() / 1000).toString(),
    Version: '2.0',
    MerchantOrderNo: order.order_no,
    Amt: Math.round(order.total_price).toString(),
    ItemDesc: order.title.slice(0, 50),
    Email: order.email || '',
    LoginType: '0',
    ReturnURL: `${process.env.FRONTEND_URL}/payment/result`,
    NotifyURL: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/payments/notify`,
    // TODO: 串接信用卡時加入 CREDIT: 1
  }).toString();

  const tradeInfo = aesEncrypt(tradeData);
  const tradeSha = sha256Hash(`HashKey=${HASH_KEY}&${tradeInfo}&HashIV=${HASH_IV}`);

  return {
    apiUrl: API_URL,
    merchantId: MERCHANT_ID,
    tradeInfo,
    tradeSha,
    version: '2.0',
  };
}

/**
 * 解析藍新金流 notify 回傳資料
 */
function parseNotify(tradeInfo) {
  if (!HASH_KEY || !HASH_IV) return null;
  const decipher = crypto.createDecipheriv('aes-256-cbc', HASH_KEY, HASH_IV);
  let decrypted = decipher.update(tradeInfo, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return Object.fromEntries(new URLSearchParams(decrypted));
}

module.exports = { buildPaymentParams, parseNotify };
