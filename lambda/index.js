'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
  signatureVersion: 'v4',
});
const Sharp = require('sharp');

const RESIZE_BASE_SIZE = 1024*1024*2;

let BUCKET = process.env.BUCKET||'resize-test';
const URL = process.env.URL||' http://resize-test.s3-website.cn-north-1.amazonaws.com.cn/';

exports.handler = function(event, context, callback) {
  let key, match, originalKey;
  let width = 1024;
  let height = 1024;
  if (event.queryStringParameters) {
    key = event.queryStringParameters.key;
    match = key.match(/(\d+)x(\d+)\/(.*)/);
    width = parseInt(match[1], 10);
    height = parseInt(match[2], 10);
    originalKey = match[3];
  } else if (event.Records && event.Records.length>0) {
    let item = event.Records[0];
    if (item.s3.object.size < RESIZE_BASE_SIZE) {
      return callback(null);
    }
    BUCKET = item.s3.bucket.name;
    originalKey = item.s3.object.key
    match = originalKey.match(/(\d+)x(\d+)\/(.*)/);
    if (match && match.length > 2) {
      return callback(null)
    }
    key = width+'x'+height+'/'+originalKey;
  }

  S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
    .then(data => Sharp(data.Body)
      .resize(width, height)
      .max()
      .jpeg()
      .toBuffer()
    )
    .then(buffer => S3.putObject({
        Body: buffer,
        Bucket: BUCKET,
        ContentType: 'image/jpg',
        Key: key,
      }).promise()
    )
    .then(() => callback(null, {
        statusCode: '301',
        headers: {'location': `${URL}/${key}`},
        body: '',
      })
    )
    .catch(err => callback(err))
}
