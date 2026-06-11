const axios = require('axios');

async function sendSms(phone, message) {
  const provider = process.env.SMS_PROVIDER || 'dev';

  if (provider === 'dev') {
    console.log(`\n[SMS DEV] To: ${phone}\n[SMS DEV] Message: ${message}\n`);
    return;
  }

  if (provider === 'bulksmsbd') {
    await _sendViaBulkSmsBd(phone, message);
    return;
  }

  if (provider === 'sslwireless') {
    await _sendViaSslWireless(phone, message);
    return;
  }

  if (provider === 'twilio') {
    await _sendViaTwilio(phone, message);
    return;
  }

  throw new Error(`Unknown SMS_PROVIDER: ${provider}`);
}

async function _sendViaBulkSmsBd(phone, message) {
  const apiKey   = process.env.SMS_BULKSMSBD_API_KEY;
  const senderId = process.env.SMS_BULKSMSBD_SENDERID;

  if (!apiKey || !senderId) throw new Error('bulksmsbd credentials not configured');

  const to = phone.startsWith('+') ? phone.slice(1) : phone;

  const res = await axios.get('http://bulksmsbd.net/api/smsapi', {
    params: { api_key: apiKey, type: 'text', number: to, senderid: senderId, message },
    timeout: 15000,
  });

  const body = (typeof res.data === 'object') ? JSON.stringify(res.data) : String(res.data);
  const code = (res.data && res.data.response_code != null) ? String(res.data.response_code) : body;

  if (!code.includes('202')) {
    throw new Error(`bulksmsbd error: ${body}`);
  }
}

async function _sendViaSslWireless(phone, message) {
  const user     = process.env.SMS_SSLWIRELESS_USER;
  const password = process.env.SMS_SSLWIRELESS_PASSWORD;
  const sender   = process.env.SMS_SSLWIRELESS_SENDER || 'NOORBEAUTY';

  if (!user || !password) throw new Error('SSL Wireless credentials not configured');

  const to = phone.startsWith('+') ? phone.slice(1) : phone;

  const res = await axios.post('https://sms.sslwireless.com/pushapi/dynamic/server.php', null, {
    params: { user, password, msg: message, sid: sender, msisdn: to },
    timeout: 10000,
  });

  if (!res.data.toString().includes('1000')) {
    throw new Error(`SSL Wireless error: ${res.data}`);
  }
}

async function _sendViaTwilio(phone, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_FROM;

  if (!accountSid || !authToken || !from) throw new Error('Twilio credentials not configured');

  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    new URLSearchParams({ From: from, To: phone, Body: message }),
    {
      auth: { username: accountSid, password: authToken },
      timeout: 10000,
    }
  );
}

module.exports = { sendSms };