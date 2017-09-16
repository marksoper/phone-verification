const AWS = require('aws-sdk');
const asyncawait = require('asyncawait');
const plivo = require('plivo');
const config = require('./config');

const cloudwatchlogs = new AWS.CloudWatchLogs({ apiVersion: '2014-03-28' });

const asyncMod = asyncawait.async;
const awaitMod = asyncawait.await;

//
// Event Logging (to be extracted to module)
// duplicative across all three Lambda functions
// TODO: extract to a module to make DRY
//

function createLogStream(eventType, phoneNumber, smsCode) {
  const logStreamName = `${eventType}--${phoneNumber}--${smsCode}`;
  return new Promise(resolve => {
    const params = {
      logGroupName: 'verificationEventLog',
      logStreamName
    };
    cloudwatchlogs.createLogStream(params, (err, data) => {
      resolve({
        requestParams: params,
        response: err || data
      });
    });
  });
}

function logEvent(ev) {
  const phoneNumber = ev.eventData.destinationPhoneNumber;
  const smsCode = ev.eventData.smsCode;
  const message = `${ev.eventType} -- ${JSON.stringify(ev.eventData)}`;
  const params = {
    logEvents: [
      {
        message,
        timestamp: Date.now()
      }
    ],
    logGroupName: 'verificationEventLog'
  };
  return new Promise(resolve => {
    createLogStream(
      ev.eventType,
      phoneNumber,
      smsCode
    ).then(createLogStreamRes => {
      if (createLogStreamRes.response instanceof Error) {
        resolve({
          requestParams: createLogStreamRes.requestParams,
          response: createLogStreamRes.err
        });
      } else {
        params.logStreamName = createLogStreamRes.requestParams.logStreamName;
        cloudwatchlogs.putLogEvents(params, (err, data) => {
          resolve({
            requestParams: params,
            response: err || data
          });
        });
      }
    });
  });
}

//
// API Communication
// duplicative across all three Lambda functions
// TODO: extract to a module to make DRY
//

function logError(err) {
  console.log(`API ERROR -- ${JSON.stringify(err)}`);
}

//
// exports.sendSMSVerificationCode()
//
// this is the Lambda handler
// - receives a kinesis record (initially this is hard-wired to kinesis)
//   with { smsCode, phoneNumber }
// - sends SMS with verification code to the phone number using Plivo
// - logs a key event
//

const sendSMSVerificationCode = asyncMod((event, context, callback) => {
  const plivoAPI = plivo.RestAPI({
    authId: config.plivo.authId,
    authToken: config.plivo.authToken
  });
  if (!event.Records) {
    throw new Error(`expecting kinesis trigger with event.Records`);
  }
  const eventRecordDataJSON = new Buffer(
    event.Records[0].kinesis.data,
    'base64'
  ).toString('ascii');
  const eventRecordData = JSON.parse(eventRecordDataJSON);
  const eventType = eventRecordData.eventType;
  if (eventType !== 'request-verification-code') {
    throw new Error(
      `send-sms-verification-code handler received eventType: ${eventType}`
    );
  }
  const eventData = eventRecordData.eventData;
  const phoneNumber = eventData.phoneNumber;
  const smsCode = eventData.smsCode;
  const smsMessage = `Your activation code is ${smsCode}`;
  const params = {
    src: '16178293399',
    dst: phoneNumber,
    text: smsMessage,
    method: 'POST'
  };
  const evt = {
    eventType: 'auth-send-sms-verification-code',
    eventTimestamp: Date.now(),
    eventData: {
      sourcePhoneNumber: params.src,
      destinationPhoneNumber: params.dst,
      messageText: params.text,
      smsCode
    }
  };
  const logEventResponse = awaitMod(logEvent(evt));
  if (logEventResponse instanceof Error) {
    logError(logEventResponse);
  }
  plivoAPI.send_message(params, (status, response) => {
    const functionResponse = {
      statusCode: 200,
      body: JSON.stringify({
        inputEvent: event,
        params,
        plivoStatus: status,
        plivoResponse: response
      })
    };
    callback(null, functionResponse);
  });
});

exports.sendSMSVerificationCode = sendSMSVerificationCode;
