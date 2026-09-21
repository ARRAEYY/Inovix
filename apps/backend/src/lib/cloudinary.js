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
 *                                   IGNORED for the `students` folder when
 *                                   `opts.ownerId` is set — see INO-006 below.
 * @param {object} [opts.tags]   - Extra tags (key→value) to attach as string tags
 * @param {string} [opts.outletId] - Outlet scoping tag
 * @param {string} [opts.ownerId]   - For the `students` folder, the authenticated
 *                                   user id. The signed public_id becomes
 *                                   `students/<ownerId>/<random>` so the client
 *                                   can't choose the object name.
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

  // ─── INO-006 + INO-P1-18 fix: server-controlled namespace ───────────────
  // The `students` folder accepts user-uploaded profile pictures. The
  // `menu-items` and `outlet-logos` folders accept outlet-scoped uploads.
  // For ALL three folders, the client-supplied publicId is ignored when an
  // `ownerId` is provided — the server scopes the object name to
  // `<folder>/<ownerId>/<timestamp>-<random>`. This means:
  //   - students/<userId>/...        → one student can't impersonate another
  //   - menu-items/<outletId>/...   → provably owned by that outlet
  //   - outlet-logos/<outletId>/... → provably owned by that outlet
  //
  // `overwrite=false` reduces the impact of a client-controlled id, but
  // the namespace must be server-controlled to make the path itself
  // a verifiable ownership claim.
  //
  // For the `students` folder specifically, refusing to sign without an
  // ownerId is enforced — there's no other valid owner. For other folders
  // without an ownerId, we fall back to `<folder>/<timestamp>-<random>`
  // (used by SUPER_ADMIN who can manage any outlet's media library
  // directly, so client-supplied publicId is honored).
  let publicId;
  if (opts.ownerId) {
    publicId = `${folder}/${opts.ownerId}/${timestamp}-${Math.random().toString(36).slice(2, 10)}`;
  } else if (folder === 'students') {
    // No ownerId supplied for students — refuse to sign rather than fall
    // back to a client-controlled id.
    throw {
      statusCode: 400,
      code: 'INVALID_UPLOAD_REQUEST',
      message: 'students folder requires an ownerId (authenticated user id)',
    };
  } else if (opts.publicId) {
    publicId = `${folder}/${opts.publicId}`;
  } else {
    publicId = `${folder}/${timestamp}-${Math.random().toString(36).slice(2, 10)}`;
  }

  // Params to sign. Cloudinary signs over the alphabetical-sorted, k=v-joined string.
  //
  // ─── INO-005 fix: enforce resource_type + allowed_formats in the signature ──
  // The previous implementation only signed `folder`, `public_id`, `overwrite`,
  // `unique_filename`, `tags`, `timestamp`. The doc comment claimed MIME + size
  // were enforced, but they weren't. The upload URL was `/auto/upload`, which
  // lets the client upload ANY resource type (image, video, raw file) — a
  // student authorized for `students/` could upload non-image payloads.
  //
  // Fix: lock the signature to `resource_type=image` + an allow-list of
  // image formats. Any upload that doesn't match these will be rejected by
  // Cloudinary because the signature won't validate. The upload URL is also
  // switched from `/auto/upload` to `/image/upload`.
  const tags = ['nosh', folder];
  if (opts.outletId) tags.push(`outlet:${opts.outletId}`);
  if (opts.ownerId) tags.push(`owner:${opts.ownerId}`);
  // INO-adj-19 fix: previously `opts.tags` (client-supplied) was appended
  // to the signed payload, letting any authenticated client inject
  // arbitrary Cloudinary tags into the media library. Tags are not an
  // authorization mechanism, but untrusted metadata pollutes the library
  // and could be used to confuse downstream tooling. Server-only now.
  // (The `opts.tags` field is still accepted for API compatibility but is
  // silently ignored.)

  const paramsToSign = {
    folder,
    public_id: publicId,
    overwrite: 'false',
    unique_filename: 'true',
    resource_type: 'image',
    allowed_formats: 'jpg,jpeg,png,webp,gif',
    tags: tags.join(','),
    timestamp,
  };

  // api_sign_request returns the SHA-1 hex of the sorted params + api_secret
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

  return {
    // Use the image-specific upload endpoint, not the generic /auto/upload.
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
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
