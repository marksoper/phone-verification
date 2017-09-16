const AWS = require('aws-sdk');
const asyncawait = require('asyncawait');
const crypto = require('crypto');

const asyncMod = asyncawait.async;
const awaitMod = asyncawait.await;
const cloudwatchlogs = new AWS.CloudWatchLogs({ apiVersion: '2014-03-28' });
const kinesis = new AWS.Kinesis();
const dynamo = new AWS.DynamoDB();

//
// Event Logging (to be extracted to module)
// duplicative across all three Lambda functions
// TODO: extract to a module to make DRY
//

function createLogStream(phoneNumber, smsCode) {
  const logStreamName = `auth-request-verification-code--${phoneNumber}--${smsCode}`;
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
  const phoneNumber = ev.eventData.phoneNumber;
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
    createLogStream(phoneNumber, smsCode).then(createLogStreamRes => {
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

function emitEvent(ev) {
  const Data = JSON.stringify(ev);
  const params = {
    Data,
    StreamName: 'paStream',
    PartitionKey: 'shardId-000000000000'
  };
  console.log(`emitEvent params: ${JSON.stringify(params)}`);
  return new Promise(resolve => {
    kinesis.putRecord(params, (err, data) => {
      console.log(`emitEvent err/res: ${JSON.stringify(err || data)}`);
      resolve({
        requestParams: params,
        response: err || data
      });
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

function logAPIResponse(res) {
  console.log(`API SUCCESS -- ${JSON.stringify(res)}`);
}

function sendResponse(resBody, err, cb) {
  const res = {
    headers: {
      'Content-Type': 'application/json'
    }
  };
  if (err) {
    res.status = '400';
    res.body = err.message;
    logError(res);
  } else {
    res.status = '200';
    res.body = resBody;
    logAPIResponse(res);
  }
  cb(null, res);
}

//
// Phone / SMS / Url Utilities (to be extracted to module)
//

//
// make sure phoneNumber conforms to a real phone number
//
function validatePhoneNumber(phoneNumber) {
  //
  // initially a no-op
  //
  return phoneNumber;
}

function generateSMSCode() {
  let code = 0;
  while (String(code).length !== 6) {
    code = Math.floor(1000000 * Math.random());
  }
  return code;
}

//
// generateVerificationChallenge()
//
// dynamoDB.putItem to VerificationChallenges table
//

function generateVerificationChallenge(phoneNumber) {
  const smsCode = generateSMSCode();
  const createdDateObj = new Date();
  const createdDate = createdDateObj.toISOString().split('T')[0];
  const createdTimestamp = createdDateObj.valueOf();
  const isVerified = false;
  const params = {
    TableName: 'VerificationChallenges',
    Item: {
      createdDate: {
        S: createdDate
      },
      smsCode: {
        N: String(smsCode)
      },
      phoneNumber: {
        S: phoneNumber
      },
      createdTimestamp: {
        N: String(createdTimestamp)
      },
      isVerified: {
        BOOL: isVerified
      }
    }
  };
  return new Promise(resolve => {
    dynamo.putItem(params, (err, data) => {
      resolve({
        requestParams: params,
        response: err || data
      });
    });
  });
}

//
// exports.requestVerificationCode()
//
// this is the Lambda handler
// - receives an API request with { phoneNumber }
// - creates a verification challenge in DB
// - logs a key event
// - emits a key event (for subscribers who will send SMS, etc.)
//

const requestVerificationCode = asyncMod((event, context, callback) => {
  //
  // validate method
  //
  const method = event.httpMethod;
  if (method !== 'POST') {
    return sendResponse(
      {},
      new Error(`method ${method} is not supported`),
      callback
    );
  }
  //
  // parse body
  //
  let body = event.body;
  if (typeof body === 'string') {
    body = JSON.parse(body);
  }
  //
  // validate that phoneNumber exists
  //
  const phoneNumber = body.phoneNumber;
  if (!phoneNumber) {
    return sendResponse({}, new Error(`phoneNumber is required`), callback);
  }
  //
  // additional check that phoneNumber is a valid phone number
  //
  const isValidPhone = awaitMod(validatePhoneNumber(phoneNumber));
  if (!isValidPhone) {
    return sendResponse({}, new Error(`invalid phoneNumber`), callback);
  }
  //
  // call the API to request that a verification challenge be created
  //
  const verifChallenge = awaitMod(generateVerificationChallenge(phoneNumber));
  if (verifChallenge.response instanceof Error) {
    return sendResponse({}, verifChallenge.response, callback);
  }
  //
  // prepare the "request-verification-code" (important event)
  //
  const chal = verifChallenge.requestParams.Item;
  const evt = {
    eventType: 'request-verification-code',
    eventData: {
      createdDate: chal.createdDate.S,
      smsCode: chal.smsCode.N,
      phoneNumber: chal.phoneNumber.S,
      createdTimestamp: chal.createdTimestamp.N,
      isVerified: chal.isVerified.BOOL
    }
  };
  //
  // log the "request-verification-code" (important event)
  //
  const logEventResponse = awaitMod(logEvent(evt));
  if (logEventResponse.response instanceof Error) {
    logError(logEventResponse);
  }
  //
  // we choose to "emit" the "request-verification-code" (important event)
  // we have at least one service (send-sms-verification-code) that's
  // triggered by this event
  //
  const emitEventResponse = awaitMod(emitEvent(evt));
  if (emitEventResponse.response instanceof Error) {
    logError(emitEventResponse);
  }
  //
  // conclude by sending the API response
  //
  return sendResponse({}, null, callback);
});

exports.requestVerificationCode = requestVerificationCode;
