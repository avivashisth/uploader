const {
  generateSignedUrlForSinglePartUpload,

  // multi-part
  abortMultipartUpload,
  listAllMultipartUploads,
  initiateMultipartUpload,
  completeMultipartUpload,
  generateSignedUrlForChunkUpload,
  initiateAndGetSignedUrlForMultipartUpload,
} = require('../controller');

const attachRoutes = router => {
  router.post('/api/generate-signed-url', generateSignedUrlForSinglePartUpload);
  router.post('/api/initiate-multipart-upload', initiateMultipartUpload);
  router.post('/api/abort-multipart-upload', abortMultipartUpload);
  router.post('/api/list-all-multipart-uploads', listAllMultipartUploads);
  router.post('/api/initiate-multipart-upload-with-signed-url', initiateAndGetSignedUrlForMultipartUpload);
  router.post('/api/generate-signed-url-for-chunk-upload', generateSignedUrlForChunkUpload);
  router.post('/api/complete-multipart-upload', completeMultipartUpload);
};

module.exports = attachRoutes;