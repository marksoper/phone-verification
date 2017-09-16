# Phone number verification with AWS Lambda Microservices, Kinesis, DynamoDB, Node.js, and React.js

![AWS Lambda + CloudFront + Kinesis + DynamoDB architecture — phone number verification Web App & SMS](docs/phone-verification.png)

As part of a larger project I recently built a self-contained web app that signs up a user by phone number and verifies his/her possession of that number. This might be interesting if you are:
- looking for a (non-production) example implementation of phone number verification
- interested in FaaS microservice architecture on AWS Lambda with Kinesis for inter-function communication

For full instructions, including the necessary AWS console configuration steps, see this blog post: [Phone number verification with AWS Lambda Microservices, Kinesis, DynamoDB, Node.js, and React.js](https://medium.com/@marksoper/Phone-number)

## webapp

```
cd ./webapp
yarn install
yarn start
```

## auth service

```
cd ./auth
yarn install
serverless deploy -v
```