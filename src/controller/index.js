const S3 = require('../store/s3');

const config = require('../../config');

const getKey = fileName => `uploads/${Date.now()}/${fileName}`;

const generateSignedUrlForSinglePartUpload = async (req, res) => {
  try {
    const body = req.body;

    const key = getKey(body.fileName);

    const signedUrlResponse = await S3.getSignedUrl({
      operation: 'putObject',
      Bucket: config.cloud.s3.bucket,
      Key: key,
      Expires: 450,
      ContentType: body.fileType,
    });
    // s3.getSignedUrlPromise('putObject', {
    //   Bucket: config.cloud.s3.bucket,
    //   Key: key,
    //   Expires: 450,
    //   ContentType: body.fileType,
    // });

    // const signedUrlResponse =  s3.createPresignedPost({
    //   Bucket: config.cloud.s3.bucket,
    //   // Fields: {
    //   //   key,
    //   // },
    //   Conditions: [
    //     ["eq", "$Content-Type", body.fileType],
    //     [ "eq", "$key", key ]
    //   ]
    // });

    return res.json({
      success: true,
      // ...body
      parsedUrl: signedUrlResponse,
      // parsedUrl: aws.util.urlFormat(signedUrlResponse),
      key,
    });
  } catch (ex) {
    console.error(ex);

    return res.status(400).json({
      success: false,
      error: {
        message: ex.message,
        code: ex.code,
        stack: ex.stack,
      },
    });
  }
}

const initiateMultipartUpload = async (req, res) => {
  const { fileName, fileType: ContentType} = req.body;
  try {
    const Key = getKey(fileName);

    const multipartUploadResponse = await S3.initiateMultipartUpload({
      Key,
      ContentType,
      Bucket: config.cloud.s3.bucket,
    });

    return res.send({
      success: true,
      ...multipartUploadResponse,
    });
  } catch (ex) {
    ex.message = `Error on initiating-multi-part-upload. ${ex.message}`;

    console.error(ex);

    return res.status(400).json({
      success: false,
      error: {
        message: ex.message,
        code: ex.code,
        stack: ex.stack,
      },
    });
  }
}

const abortMultipartUpload = async (req, res) => {
  try {
    const { UploadId, Key, Bucket } = req.body;

    const abortResponse = await S3.abortMultipartUpload({
      Key,
      Bucket,
      UploadId,
    });

    // s3.abortMultipartUpload({
    //   Key,
    //   Bucket,
    //   UploadId,
    // }).promise();

    return res.json({
      success: true,
      ...abortResponse
    });
  } catch (ex) {
    ex.message = `Error on aborting-multipart-upload. ${ex.message}`;

    console.error(ex);

    return res.status(400).json({
      success: false,
      error: {
        code: ex.code,
        message: ex.message,
        stack: ex.stack,
      },
    });
  }
}

const listAllMultipartUploads = async (req, res) => {
  try {
    const { bucket: Bucket = config.cloud.s3.bucket } = req.body;

    const responseObject = await S3.listAllMultipartUploads({
      Bucket,
    });

    // s3.listAllMultipartUploads({
    //   Bucket,
    // }).promise();

    return res.send({
      success: true,
      ...responseObject,
    });
  } catch (ex) {
    ex.message = `Error occurred while list all multipart-uploads. ${ex.message}`;

    console.error(ex);

    return res.status(400).send({
      success: false,
      error: {
        code: ex.code,
        message: ex.message,
        stack: ex.stack,
      },
    });
  }
};

const getSignedUrlForChunkUpload = ({ UploadId, PartNumber, Bucket, Key, }) => S3.getSignedUrl({
  operation: 'uploadPart',
  Key,
  Bucket,
  UploadId,
  PartNumber,
});

const initiateAndGetSignedUrlForMultipartUpload = async (req, res) => {
  try {
    const {
      fileName,
      fileType: ContentType,
      Bucket = config.cloud.s3.bucket,
    } = req.body;

    const Key = getKey(fileName);

    // 1. initiate multipart upload
    const initiateMultipartUploadResponse = await S3.initiateMultipartUpload({
      Key,
      ContentType,
      Bucket,
    });

    // 2. generateSignedUrl
    const signedUrlResponses = await Promise.all([
      getSignedUrlForChunkUpload({
        Key,
        Bucket,
        UploadId: initiateMultipartUploadResponse.UploadId,
        PartNumber: 1,
      }),
      getSignedUrlForChunkUpload({
        Key,
        Bucket,
        UploadId: initiateMultipartUploadResponse.UploadId,
        PartNumber: 2,
      }),
    ]);

    return res.send({
      success: true,
      ...initiateMultipartUploadResponse,
      signedUrlResponse: {
        1: signedUrlResponses[0],
        2: signedUrlResponses[1],
      },
    });
  } catch (ex) {
    ex.message = `Error occurred while initiating multi-part upload and generating signed-url. ${ex.message}`;

    console.error(ex);

    return res.status(400).send({
      success: false,
      error: {
        code: ex.code,
        stack: ex.stack,
        message: ex.message,
      },
    });
  }
};

const generateSignedUrlForChunkUpload = async (req, res) => {
  try {
    const { Key, Bucket, UploadId, currentPartNumber, totalChunksForUpload } = req.body;

    const workers = [];

    const maxPartNumber = currentPartNumber + (totalChunksForUpload - currentPartNumber > config.chunkUploads.maxSignedUrlCounts
      ? config.chunkUploads.maxSignedUrlCounts
      : totalChunksForUpload - currentPartNumber);

    for (let partNumber = currentPartNumber; partNumber <= maxPartNumber; partNumber++) {
      workers.push(getSignedUrlForChunkUpload({
        Key,
        UploadId,
        Bucket,
        PartNumber: partNumber,
      }));
    }

    const signedUrlResponses = await Promise.all(workers);

    const signedUrlObject = {};

    for (let partNumber = currentPartNumber; partNumber <= maxPartNumber; partNumber++) {
      signedUrlObject[partNumber] = signedUrlResponses.shift();
    }

    return res.send({
      success: true,
      signedUrlResponse: signedUrlObject,
    });
  } catch (ex) {
    ex.message = `Error occurred while generating signed urls for chunk uploads. ${ex.message}`;

    console.error(ex);

    return res.status(400).send({
      success: false,
      error: {
        message: ex.message,
        code: ex.code,
        stack: ex.stack,
      },
    });
  }
}

const completeMultipartUpload = async (req, res) => {
  try {
    const { UploadId, Parts, Key, Bucket, } = req.body;

    const completionResponse = await S3.completeMultipartUpload({
      Key,
      Bucket,
      UploadId,
      Parts,
    });

    return res.send({
      success: true,
      completionResponse: completionResponse,
    });
  } catch (ex) {
    ex.message = `Error occurred while completing multipart-upload. ${ex.message}`;

    console.error(ex);

    return res.status(400).send({
      success: false,
      error: {
        code: ex.code,
        stack: ex.stack,
        message: ex.message,
      },
    });
  }

}

module.exports = {
  // serveUploadPage,
  generateSignedUrlForSinglePartUpload,

  initiateMultipartUpload,
  abortMultipartUpload,
  listAllMultipartUploads,
  generateSignedUrlForChunkUpload,
  initiateAndGetSignedUrlForMultipartUpload,
  completeMultipartUpload,
};