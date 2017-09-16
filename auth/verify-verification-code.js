const AWS = require('aws-sdk');
const asyncawait = require('asyncawait');

const asyncMod = asyncawait.async;
const awaitMod = asyncawait.await;
const cloudwatchlogs = new AWS.CloudWatchLogs({ apiVersion: '2014-03-28' });
const dynamo = new AWS.DynamoDB();

//
// Event Logging (to be extracted to module)
// duplicative across all three Lambda functions
// TODO: extract to a module to make DRY
//

function createLogStream(phoneNumber, smsCode) {
  const logStreamName = `auth-verify-verification-code--${phoneNumber}--${smsCode}`;
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
// SMS code utility (to be extracted to module)
//

//
// make sure the verification code conforms to format rules
//
function validateVerificationCode(verificationCode) {
  //
  // initially a no-op
  //
  return verificationCode;
}

//
// getVerificationChallenge()
// - dynamo.getItem() from VerificationChallenges table
//

function getVerificationChallenge(verificationCode) {
  const today = new Date().toISOString().split('T')[0];
  const fullKey = {
    createdDate: {
      S: today
    },
    smsCode: {
      N: String(verificationCode)
    }
  };
  const params = {
    TableName: 'VerificationChallenges',
    Key: fullKey
  };
  return new Promise(resolve => {
    dynamo.getItem(params, (err, data) => {
      resolve({
        requestParams: params,
        response: err || data
      });
    });
  });
}

//
// updateChallengeToVerified()
// - dynamo.updateItem() in VerificationChallenges table
//

function updateChallengeToVerified(challenge) {
  const params = {
    TableName: 'VerificationChallenges',
    UpdateExpression: 'SET isVerified = :isVerified',
    ExpressionAttributeValues: {
      ':isVerified': { BOOL: true }
    },
    Key: {
      createdDate: { S: challenge.Item.createdDate.S },
      smsCode: { N: String(challenge.Item.smsCode.N) }
    }
  };
  return new Promise(resolve => {
    dynamo.updateItem(params, (err, data) => {
      resolve({
        requestParams: params,
        response: err || data
      });
    });
  });
}

//
// exports.verifyVerificationCode()
//
// this is the Lambda handler
// - receives an API request with { phoneNumber }
// - creates a verification challenge in DB
// - logs a key event
// - emits a key event (for subscribers who will send SMS, etc.)
//

const verifyVerificationCode = asyncMod((event, context, callback) => {
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
  // validate request data
  //
  let body = event.body;
  if (typeof body === 'string') {
    body = JSON.parse(body);
  }
  const verificationCode = body.verificationCode;
  if (!verificationCode) {
    return sendResponse(
      {},
      new Error(`verificationCode is required`),
      callback
    );
  }
  const isValidVerificationCode = awaitMod(
    validateVerificationCode(verificationCode)
  );
  if (!isValidVerificationCode) {
    return sendResponse({}, new Error(`invalid verificationCode`), callback);
  }
  //
  // get matching challenge from the DB
  //
  const challengeRes = awaitMod(getVerificationChallenge(verificationCode));
  const challenge = challengeRes.response;
  if (challenge instanceof Error) {
    return sendResponse({}, challenge, callback);
  }
  //
  // no matching challenge
  // an invalid verification code was attempted
  //
  if (!challenge || !challenge.Item) {
    const evt = {
      eventType: 'verify-verification-code--INVALID',
      eventTimestamp: Date.now(),
      eventData: {
        phoneNumber: 'INVALID',
        smsCode: verificationCode
      }
    };
    const logEventResponse = awaitMod(logEvent(evt));
    if (logEventResponse instanceof Error) {
      logError(logEventResponse);
    }
    return sendResponse({}, null, callback);
  }
  //
  // matching challenge was found
  // update that challenge to indicate it was verified
  //
  const markVerifiedRes = awaitMod(updateChallengeToVerified(challenge));
  if (markVerifiedRes.response instanceof Error) {
    return sendResponse({}, markVerifiedRes.response, callback);
  }
  //
  // log the event
  //
  const evt = {
    eventType: 'verify-verification-code',
    eventTimestamp: Date.now(),
    eventData: {
      smsCode: challenge.Item.smsCode.N,
      phoneNumber: challenge.Item.phoneNumber.S,
      createdDate: challenge.Item.createdDate.S
    }
  };
  const logEventResponse = awaitMod(logEvent(evt));
  if (logEventResponse instanceof Error) {
    logError(logEventResponse);
  }
  //
  // conclude by sending the API response
  //
  return sendResponse({}, null, callback);
});

exports.verifyVerificationCode = verifyVerificationCode;
