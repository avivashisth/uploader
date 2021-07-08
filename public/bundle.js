const httpRequest = async ({ url, body, method, headers = {}, returnHeaders = false }) => {
  try {
    const httpResponse = await fetch(url, {
      body,
      method,
      headers,
    });

    const responseObject = await (!returnHeaders && httpResponse.json());

    if (!httpResponse.ok) {
      throw Error(responseObject.error.message, responseObject.error.code);
    }

    return {
      body: responseObject,
      headers: httpResponse.headers,
    };
  } catch (ex) {
    console.error(ex);

    throw ex;
  }
};

const xhr = ({ url, method, body, headers = {} }) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open(method, url, true);

    xhr.onload = () => {
      const responseText = xhr.responseText;

      const status = xhr.status;

      if (status !== 200) {
        return reject(responseText);
      }

      return resolve(responseText);
    }

    for (const key in headers) {
      xhr.setRequestHeader(key, headers[key]);
    }

    xhr.send(body);
  })
};

class ProgressBar {
  constructor(fileSize) {
    this.fileSize = fileSize;

    this.uploadedSize = 0;
    this.currentLoaded = 0;
  }

  setPercentUploaded(percent) {
    percent = percent.toFixed(2);

    if (!this.progressBarElement) {
      this.progressBarElement = document.getElementById('progress_bar');
    }


    this.progressBarElement.style.width = `${percent}%`;
    this.progressBarElement.textContent = `${percent}%`;
  }

  progressEventHandler(that, event) {
    if (!event.lengthComputable) {
      that.setPercentUploaded(0);
    }

    that.currentLoaded = event.loaded;

    that.setPercentUploaded(((that.uploadedSize + that.currentLoaded)/that.fileSize) * 100);
  }

  chunkUploaded() {
    this.uploadedSize += this.currentLoaded;
  }
}

class FileUploader {
  constructor(file, uploadType) {
    if (!file) {
      throw Error(`Invalid request. File not received for upload.`);
    }

    this.file = file;
    this.uploadType = uploadType;
    this.isMultipartUpload = uploadType === 'multipartUpload';

    this.progressBarHandler = new ProgressBar(this.file.size);
  }

  static get CHUNK_SIZE() {
    return  {
      s3: 5 * 1024 * 1024,
    };
  }

  * getChunk () {
    this.processedChunkSize = 0;
    while (this.file.size > this.processedChunkSize) {
      let endChunkIndex = this.processedChunkSize + FileUploader.CHUNK_SIZE.s3;

      if (endChunkIndex > this.file.size) {
        endChunkIndex = undefined;
      }

      this.chunk = this.file.slice(this.processedChunkSize, endChunkIndex);
      this.processedChunkSize += FileUploader.CHUNK_SIZE.s3;

      yield this.chunk;
    }
  }

  uploadBlob({ url, blob, headers, method = 'PUT' }) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open(method, url, true);

      xhr.onload = () => {
        const responseText = xhr.responseText;
        let responseHeaders = xhr.getAllResponseHeaders();

        const status = xhr.status;
        responseHeaders = responseHeaders.split(`\r\n`)
          .reduce((acc, current, i) => {
            const parts = current.split(': ');

            acc[parts[0]] = parts[1];

            return acc;
          }, {});

        if (status !== 200) {
          return reject({ headers: responseHeaders, body: responseText });
        }

        return resolve({ headers: responseHeaders, body: responseText });
      }

      // TODO: add progress handler.
      xhr.upload.onprogress = this.progressBarHandler.progressEventHandler.bind(null, this.progressBarHandler);

      for (const key in headers) {
        xhr.setRequestHeader(key, headers[key]);
      }

      xhr.send(blob);
    });
  }

  async getSignedUrl() {
    const preSignedUrlResponse = await httpRequest({
      url: `/api/generate-signed-url`,
      body: JSON.stringify({
        fileName: this.file.name,
        fileSize: this.file.size,
        fileType: this.file.type,
      }),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    return preSignedUrlResponse.body.parsedUrl;
  }

  async uploadInSingleChunk() {
    const signedUrl = await this.getSignedUrl();

    const uploadResponse = await uploadBlob({
      url: signedUrl,
      body: this.file.blob(),
      method: 'PUT',
      headers: {
        'Content-Type': this.file.type,
        'Content-Length': this.file.size,
      },
      returnHeaders: true,
    });

    return uploadResponse.body;
  }

  static async abortMultipartUpload(multipartData) {
    const abortResponse = await httpRequest({
      url: `/api/abort-multipart-upload`,
      body: typeof multipartData === 'object' ? JSON.stringify(multipartData) : multipartData,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    console.log(abortResponse);
  }

  async getSignedUrlForChunkUploads({ currentPartNumber, signedUrlResponse }) {
    const signedUrlResponseObject = await httpRequest({
      url: `/api/generate-signed-url-for-chunk-upload`,
      body: JSON.stringify({
        Key: this.multipartInitiateResponse.body.Key,
        Bucket: this.multipartInitiateResponse.body.Bucket,
        UploadId: this.uploadId,
        currentPartNumber,
        totalChunksForUpload: this.totalChunksForUpload,
      }),
      method: 'POST',
      headers: {
        'Content-Type' : 'application/json'
      },
    });

    for (const partNumber in signedUrlResponseObject.body.signedUrlResponse) {
      signedUrlResponse[partNumber] = signedUrlResponseObject.body.signedUrlResponse[partNumber];
    }

    console.log(signedUrlResponse);
  }

  initiateMultipartUpload() {
    return httpRequest({
      body: JSON.stringify({
        fileName: this.file.name,
        fileType: this.file.type,
        totalChunksForUpload: this.totalChunksForUpload,
      }),
      url: `/api/initiate-multipart-upload-with-signed-url`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async uploadChunk({ chunk: blob, url, processingPartNumber: PartNumber }) {
    const uploadResponse = await this.uploadBlob({
      url,
      blob,
      headers: {
        'Content-Type': 'application/octet-stream',
        // 'Access-Control-Allow-Origin': '*',
        // 'Access-Control-Expose-Headers': 'ETag',
      },
    });

    this.progressBarHandler.chunkUploaded();

    // const uploadResponse = await httpRequest({
    //   url,
    //   body: body,
    //   method: 'put',
    //   headers: {
    //     'Content-Type': 'application/octet-stream',
    //     'Access-Control-Allow-Origin': '*',
    //     'Access-Control-Expose-Headers': 'ETag',
    //   },
    //   returnHeaders: true,
    // });

    // fetch etag from header
    const eTag = uploadResponse.headers.etag;

    if (eTag) {
      return this.multipartUploadResponses.push({
        ETag: JSON.parse(eTag),
        PartNumber,
      });
    }
  }

  async completeMultipartUpload() {
    return httpRequest({
      url: '/api/complete-multipart-upload',
      method: 'POST',
      body: JSON.stringify({
        Key: this.multipartInitiateResponse.body.Key,
        Bucket: this.multipartInitiateResponse.body.Bucket,
        UploadId: this.uploadId,
        Parts: this.multipartUploadResponses,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async multipartUpload() {
    try {
      this.totalChunksForUpload = Math.ceil(this.file.size / FileUploader.CHUNK_SIZE.s3);

      // 1. initiate multi-part upload
      const multipartInitiateResponse = await this.initiateMultipartUpload();

      this.multipartUploadResponses = [];

      this.uploadId = multipartInitiateResponse.body.UploadId;
      this.multipartInitiateResponse = multipartInitiateResponse;

      const signedUrlResponse = multipartInitiateResponse.body.signedUrlResponse;

      this.signedUrlResponse = signedUrlResponse;

      const chunk = this.getChunk();
      let currentPartNumber = 1;

      let blob = chunk.next();
      while (blob.value) {
        const processingPartNumber = currentPartNumber++;
        const url = signedUrlResponse[processingPartNumber];

        const workers = [];
        if (!signedUrlResponse[currentPartNumber] && currentPartNumber <= this.totalChunksForUpload) {
          console.log(`Fetching signed URL for chunks beginning from chunk# ${currentPartNumber}, total-chunks#: ${this.totalChunksForUpload}`);
          // all signed urls exhausted
          // fetch remainder of signed urls
          workers.push(this.getSignedUrlForChunkUploads({
            currentPartNumber,
            signedUrlResponse,
          }));
        }

        console.log(`Uploading chunk`);
        workers.push(
          this.uploadChunk({ chunk: blob.value, url, processingPartNumber })
        );

        await Promise.all(workers);

        blob = chunk.next();
      }

      const uploadResponse = await this.completeMultipartUpload();

      console.log(uploadResponse);

      return this.uploadId = undefined;
    } catch (ex) {
      // abort upload
      await FileUploader.abortMultipartUpload(this.multipartInitiateResponse.body);
      this.uploadId = undefined;

      throw ex;
    }
  }

  static async abortAllMultipartUploads() {
    const allMultipartUploads = await httpRequest({
      url: '/api/list-all-multipart-uploads',
      method: 'POST',
      body: JSON.stringify({}),
    });

    for (const uploadObj of allMultipartUploads.body.Uploads) {
      await FileUploader.abortMultipartUpload({
        ...uploadObj,
        Bucket: allMultipartUploads.body.Bucket,
      });
    }

    console.log(`All multipart uploads aborted!!`);
  }
}

const uploadFiles = async files => {
  const uploadType = document.getElementById('uploadType').value;

  for (const file of files) {
    console.log(`Upload in progress for File: ${file.name} of size: ${file.size} bytes`);
    // const preSignedUrl = await getSignedUrlForFile(file);

    const fileUploader = new FileUploader(file, uploadType);
    let uploadResponse;

    if (uploadType === 'singleChunk') {
      console.log(`Uploading using single chunk`);
      uploadResponse = await fileUploader.uploadInSingleChunk();
    } else {
      console.log(`Uploading using Multi-Part Upload.`);

      uploadResponse = await fileUploader.multipartUpload();
    }

    console.log(`Upload complete for file: ${file.name}.`);
    console.dir(uploadResponse);
  }
}

const onFileSelected = async (event) => {
  console.log('File selected!!');
  const sourceElement = event.currentTarget;
  const files = sourceElement.files;

  if (files.length === 0) {
    return console.log('0 files selected');
  }

  const fileNameList = [];
  for (const file of files) {
    fileNameList.push(file.name);
  }

  const fileLabel = document.getElementById('selected_file_label');

  fileLabel.innerHTML = fileNameList.join('; ');

  console.log(`Selected Files: ${fileNameList.join(', ')}`);

  await uploadFiles(files);

  console.log('All files uploaded!!');
  fileLabel.innerHTML = 'Choose File';

  sourceElement.value = '';
}

window.onload = () => {
  console.log('loaddedd!')

  // attach listeners
  document.getElementById('customFile').onchange = onFileSelected;
  document.getElementById('abort-all-multipart-uploads').onclick = FileUploader.abortAllMultipartUploads;
}
