const ENDPOINT_PATTERN = /^(.+\.)?s3[.-]([a-z0-9-]+)\./;

interface BucketInfo {
  bucket?: string | null;
  err?: string;
}

export function isUrlFromBucket(fileUrl: string, bucketName: string, bucketBaseUrl = ''): boolean {
  const url = new URL(fileUrl);

  // Check if the file URL is using a base URL (e.g. a CDN).
  // In this case, check if the file URL starts with the same base URL as the bucket URL.
  if (bucketBaseUrl) {
    const baseUrl = new URL(bucketBaseUrl);
    return url.href.startsWith(baseUrl.href);
  }

  const { bucket } = getBucketFromAwsUrl(fileUrl);

  if (bucket) {
    return bucket === bucketName;
  }

  // File URL might be of an S3-compatible provider. (or an invalid URL)
  // In this case, check if the bucket name appears in the URL host or path.
  // e.g. https://minio.example.com/bucket-name/object-key
  // e.g. https://bucket.nyc3.digitaloceanspaces.com/folder/img.png
  return url.host.startsWith(`${bucketName}.`) || url.pathname.includes(`/${bucketName}/`);
}

/**
 * Parse the bucket name from a URL.
 * See all URL formats in https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-bucket-intro.html
 *
 * @param {string} fileUrl - the URL to parse
 * @returns {object} result
 * @returns {string} result.bucket - the bucket name
 * @returns {string} result.err - if any
 */
function getBucketFromAwsUrl(fileUrl: string): BucketInfo {
  const url = new URL(fileUrl);

  // S3://<bucket-name>/<key>
  if (url.protocol === 's3:') {
    const bucket = url.host;

    if (!bucket) {
      return { err: `Invalid S3 url: no bucket: ${url}` };
    }
    return { bucket };
  }

  if (!url.host) {
    return { err: `Invalid S3 url: no hostname: ${url}` };
  }

  const matches = url.host.match(ENDPOINT_PATTERN);
  if (!matches) {
    return { err: `Invalid S3 url: hostname does not appear to be a valid S3 endpoint: ${url}` };
  }

  const prefix = matches[1];
  // https://s3.amazonaws.com/<bucket-name>
  if (!prefix) {
    if (url.pathname === '/') {
      return { bucket: null };
    }

    const index = url.pathname.indexOf('/', 1);

    // https://s3.amazonaws.com/<bucket-name>
    if (index === -1) {
      return { bucket: url.pathname.substring(1) };
    }

    // https://s3.amazonaws.com/<bucket-name>/
    if (index === url.pathname.length - 1) {
      return { bucket: url.pathname.substring(1, index) };
    }

    // https://s3.amazonaws.com/<bucket-name>/key
    return { bucket: url.pathname.substring(1, index) };
  }

  // https://<bucket-name>.s3.amazonaws.com/
  return { bucket: prefix.substring(0, prefix.length - 1) };
}
