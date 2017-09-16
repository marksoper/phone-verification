# Phone number verification with AWS Lambda Microservices, Kinesis, DynamoDB, Node.js, and React.js

![AWS Lambda + CloudFront + Kinesis + DynamoDB architecture — phone number verification Web App & SMS](docs/phone-verification.png)

As part of a larger project I recently built a self-contained web app that signs up a user by phone number and performs [phone number verification](https://en.wikipedia.org/wiki/Telephone_number_verification) by verifying his/her possession of that number. This might be interesting if you are:
- looking for a (non-production) example implementation of [phone number verification](https://en.wikipedia.org/wiki/Telephone_number_verification)
- interested in serverless (AKA FaaS) microservice architecture using [AWS Lambda](https://aws.amazon.com/lambda/) in an [event-driven architecture](https://en.wikipedia.org/wiki/Event-driven_architecture) based on [AWS Kinesis Streams](https://docs.aws.amazon.com/streams/latest/dev/introduction.html)

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