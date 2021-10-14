require('dotenv').config();

module.exports = {
  app: {
    port: process.env.SERVER_PORT || 7676,
  },
  // cloud-storage
  cloud: {
    s3: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      bucket: process.env.AWS_BUCKET,
    },
  },

  // internal app constants
  chunkUploads: {
    maxSignedUrlCounts: 4,
  },
};