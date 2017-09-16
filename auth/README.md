
# phone-verification auth service

## config

There must be a file #config.js# in this directory.
It should look like this.

```
module.exports = {
  plivo: {
    authId: '< your authId here >',
    authToken: '< your authToken here >'
  }
}
```

## Async await

At present Lambda does not support Node.js 7.x, so [asyncawait](https://github.com/yortus/asyncawait) is used