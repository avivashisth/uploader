const S3 = require('aws-sdk/clients/s3');

const config = require('../../config');

let s3Connector;

const getConnector = () => {
  if (!s3Connector) {
    s3Connector = new S3({
      apiVersion: '2006-03-01',
      accessKeyId: config.cloud.s3.accessKeyId,
      secretAccessKey: config.cloud.s3.secretAccessKey,
      signatureVersion: 'v4',
      region: 'ap-south-1'
    });
  }

  return s3Connector;
}

const getSignedUrl = ({
  operation = 'getObject',
  Key,
  Bucket = config.cloud.s3.bucket,
  Expires = 450,
  UploadId,
  PartNumber,
  ContentType,
}) => getConnector()
  .getSignedUrlPromise(operation, {
    Key,
    Bucket,
    Expires,
    UploadId,
    PartNumber,
    ContentType,
  });

// #region multi-part

const initiateMultipartUpload = ({ Key, ContentType, Bucket = config.cloud.s3.bucket }) => getConnector()
  .createMultipartUpload({
    Key,
    Bucket,
    ContentType,
  }).promise();

const abortMultipartUpload = ({ UploadId, Key, Bucket = config.cloud.s3.bucket }) => getConnector()
  .abortMultipartUpload({
    Key,
    Bucket,
    UploadId,
  }).promise();

const completeMultipartUpload = ({ Key, Bucket = config.cloud.s3.bucket, UploadId, Parts, }) => getConnector()
  .completeMultipartUpload({
    Key,
    Bucket,
    UploadId,
    MultipartUpload: { Parts },
  }).promise();

const listAllMultipartUploads = ({ Bucket = config.cloud.s3.bucket }) => getConnector()
  .listMultipartUploads({
    Bucket,
  }).promise();

// #endregion multi-part

module.exports = {
  getSignedUrl,

  // multi-part
  abortMultipartUpload,
  initiateMultipartUpload,
  completeMultipartUpload,
  listAllMultipartUploads,
};
