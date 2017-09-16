import config from './config';

const defaultHeaders = {
  'Content-Type': 'application/json'
};

const apiBaseUrl = `https://${config.apiDomain}/auth`;

function requestVerificationCode(phone) {
  const url = `${apiBaseUrl}/request-verification-code`;
  const headers = new Headers();
  headers.append('Content-Type', defaultHeaders['Content-Type']);
  const body = JSON.stringify({ phoneNumber: phone });
  const init = {
    method: 'POST',
    mode: 'no-cors',
    headers,
    body
  };
  const request = new Request(url);
  return fetch(request, init);
}

function verifyVerificationCode(code, phoneNumber) {
  const url = `${apiBaseUrl}/verify-verification-code`;
  const headers = new Headers();
  headers.append('Content-Type', defaultHeaders['Content-Type']);
  const body = JSON.stringify({
    verificationCode: code,
    phoneNumber
  });
  const init = {
    method: 'POST',
    mode: 'no-cors',
    headers,
    body
  };
  const request = new Request(url);
  return fetch(request, init);
}

const api = {
  requestVerificationCode,
  verifyVerificationCode
};

export default api;
