# S3 Uploads using Signed URLs

  Demonstrates S3 uploads using Signed URLs without exposing AWS credentials on client-side i.e. browser.


## Features

  Support 2 types of upload

  - Single Chunk upload i.e. file is uploaded in a one-part.
  - Multi-Part upload i.e. file is broken into multiple parts for this, file-size should be more than 5MB.

  1. Multi-Part Uploads.
      - For Multi-Part uploads, browser first requests server to initiate multi-upload upload and fetches 2 signed URLs, these signed URLs are then used to upload files. If file has more than 2 chunks then browser make another request to server for signed-urls and based on total number of chunks, server returns maximum 4(this is configurable from [config.js]) signed URLs in a single call.
      - Once all chunks are uploaded, browser makes another request to server requesting to complete multi-part upload.
  2. Single Part Upload.
      - In this file is uploaded in just 1 part.
      - Browser first requests server for a signed URL, and then uploads the file on the same URL.


## Setting Up
  1. Clone repo.
  2. Install node dependencies using command `npm i`.
  3. Add environment variables in .env file as described in .env_sample.
  4. Start server using command `npm start`.
  5. Open the URL `localhost:PORT_NUMBER` and it open up the upload form.


[config.js]: ./config/index.js