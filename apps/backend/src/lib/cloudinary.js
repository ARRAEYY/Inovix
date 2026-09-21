/**
 * Cloudinary SDK config + signed-upload helper.
 *
 * Spec ref: §2 principle 5 — "Images use Cloudinary with signed uploads from
 * backend; frontend never holds Cloudinary credentials."
 *
 * Why signed uploads (not unsigned):
 *   - Unsigned uploads require a Cloudinary "upload preset" with looser
 *     validation; they're risky if abused.
 *   - Signed uploads let the backend enforce: folder, public_id format,
 *     max file size, allowed MIME types — all encoded in the signature.
 *   - The signature is HMAC-SHA256 over a sorted params→secret string; the
 *     secret never leaves the backend.
 *
 * The frontend then POSTs the file *directly* to Cloudinary (multipart/form-data)
 * with the signed params. The backend never proxies the bytes — saves bandwidth
 * + latency.
 *
 * Env (set in .env):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

const cloudinary = require('cloudinary').v2;

function isConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

if (isConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Generate a signed-upload payload for the frontend to POST to Cloudinary.
 *
 * @param {object} opts
 * @param {string} opts.folder   - "menu-items" | "outlet-logos" | "students"
 * @param {string} [opts.publicId] - Optional explicit public_id (without folder).
 *                                   If omitted, Cloudinary auto-generates one.
 * @param {object} [opts.tags]   - Extra tags (key→value) to attach as string tags
 * @param {string} [opts.outletId] - Outlet scoping tag (recommended)
 * @returns {{ uploadUrl, publicId, apiKey, timestamp, signature, cloudName, params }}
 */
function signUpload(opts = {}) {
  if (!isConfigured()) {
    throw {
      statusCode: 500,
      code: 'CLOUDINARY_NOT_CONFIGURED',
      message: 'Cloudinary env vars are not set. See .env.example.',
    };
  }

  const folder = opts.folder || 'misc';
  const timestamp = Math.floor(Date.now() / 1000);
  // public_id is folder + optional name (no extension — Cloudinary infers from MIME)
  const publicId = opts.publicId
    ? `${folder}/${opts.publicId}`
    : `${folder}/${timestamp}-${Math.random().toString(36).slice(2, 10)}`;

  // Params to sign. Cloudinary signs over the alphabetical-sorted, k=v-joined string.
  // We enforce:
  //   - folder (so the asset lands in the right bucket)
  //   - public_id (so the frontend can't impersonate another asset)
  //   - overwrite=false (no replacing existing assets)
  //   - unique_filename=true (defensive)
  //   - tags (so we can filter in the media library)
  const tags = ['nosh', folder];
  if (opts.outletId) tags.push(`outlet:${opts.outletId}`);
  if (opts.tags) Object.values(opts.tags).forEach(t => tags.push(String(t)));

  const paramsToSign = {
    folder,
    public_id: publicId,
    overwrite: 'false',
    unique_filename: 'true',
    tags: tags.join(','),
    timestamp,
  };

  // api_sign_request returns the SHA-1 hex of the sorted params + api_secret
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    publicId,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    timestamp,
    signature,
    // The frontend POSTs multipart/form-data with these fields + the file.
    params: paramsToSign,
  };
}

module.exports = {
  signUpload,
  isConfigured,
};
