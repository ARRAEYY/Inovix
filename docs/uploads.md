# Nosh — Cloudinary Uploads

> Spec ref: §2 principle 5 — "Images use Cloudinary with signed uploads from backend; frontend never holds Cloudinary credentials."
> Status: Implemented (`apps/backend/src/modules/uploads/` + `src/lib/cloudinary.js`)

## 1. Architecture

```
┌────────────┐         POST /api/v1/uploads/sign           ┌──────────┐
│  Frontend  │ ───────────────────────────────────────────►│  Backend  │
│            │                                                 │           │
│            │ ◄───────────────────────────────────────────│           │
│            │   { uploadUrl, signature, publicId, ... }     │           │
│            │                                                 │           │
│            │  POST multipart/form-data to Cloudinary       │           │
│            │ ─────────────────────────────────────────────────────►│ Cloudinary │
│            │                                                       │              │
│            │   200 { secure_url, public_id, ... }                │              │
│            │ ◄─────────────────────────────────────────────────│              │
│            │                                                       │              │
│            │  PATCH /api/v1/outlet/menu/:id  { image: secure_url }│           │
│            │ ─────────────────────────────────────────────────►│  Backend  │
└────────────┘                                                       └──────────┘
```

Backend never proxies image bytes. The signature is HMAC-SHA1 over sorted params + `CLOUDINARY_API_SECRET` — the secret never leaves the backend.

## 2. Endpoint

### `POST /api/v1/uploads/sign`

Mint a signed-upload payload for the frontend to POST directly to Cloudinary.

- **Auth**: Bearer access token. Role policy per folder (see below).
- **Body**:
  ```json
  {
    "folder": "menu-items" | "outlet-logos" | "students",
    "publicId": "optional-slug",     // [a-zA-Z0-9_-]{1,120}
    "tags": { "key": "value" }        // optional extra tags
  }
  ```
- **Response 200**:
  ```json
  {
    "success": true,
    "data": {
      "uploadUrl": "https://api.cloudinary.com/v1_1/<cloud>/auto/upload",
      "publicId": "menu-items/1695300000-a1b2c3d4",
      "apiKey": "<your api key>",
      "cloudName": "<your cloud name>",
      "timestamp": 1695300000,
      "signature": "<sha1 hex>",
      "params": { "folder": "...", "public_id": "...", "overwrite": "false", "unique_filename": "true", "tags": "...", "timestamp": ... }
    }
  }
  ```
- **Errors**: 400 (invalid folder / invalid publicId), 403 (role not allowed for folder), 500 (Cloudinary not configured — `CLOUDINARY_NOT_CONFIGURED`)
- **Side effects**: AuditLog (`UPLOAD_SIGNED`, targetType=`Cloudinary`, targetId=`publicId`)

## 3. Folder policies

| Folder          | Allowed roles                                | Use                                              |
|-----------------|-----------------------------------------------|--------------------------------------------------|
| `menu-items`    | `OUTLET_ADMIN`, `SUPER_ADMIN`                  | Item image uploads                                |
| `outlet-logos`  | `OUTLET_ADMIN`, `SUPER_ADMIN`                  | Outlet logo / banner                              |
| `students`      | `STUDENT`, `SUPER_ADMIN`                       | Student profile picture                          |

Each signed payload includes `tags` so the Cloudinary media library is filterable:

- `nosh` — all assets
- `<folder name>` — e.g. `menu-items`
- `outlet:<outletId>` — when `req.user.outletId` is set, the upload is tagged with the outlet's id so an outlet admin can't pollute another outlet's namespace

## 4. Frontend integration

```js
// 1. Get signed payload from backend
const { data } = await api.post('/uploads/sign', {
  folder: 'menu-items',
  publicId: 'dosa-special', // optional — backend auto-generates if omitted
});

// 2. POST the file directly to Cloudinary (bypass backend = no bandwidth on backend)
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('api_key', data.apiKey);
formData.append('timestamp', data.timestamp);
formData.append('signature', data.signature);
formData.append('folder', data.params.folder);
formData.append('public_id', data.params.public_id);
formData.append('overwrite', data.params.overwrite);
formData.append('unique_filename', data.params.unique_filename);
formData.append('tags', data.params.tags);

const cloudinaryRes = await fetch(data.uploadUrl, {
  method: 'POST',
  body: formData,
});
const cloudinaryData = await cloudinaryRes.json();
// { secure_url: "https://res.cloudinary.com/<cloud>/image/upload/v.../menu-items/dosa-special.jpg", public_id, ... }

// 3. Save the URL on the relevant resource
await api.patch(`/outlet/menu/${itemId}`, { image: cloudinaryData.secure_url });
```

## 5. Environment variables

Required in `.env`:

```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

If any are unset, the `/uploads/sign` endpoint returns 500 with `code: CLOUDINARY_NOT_CONFIGURED`. The backend still boots (the rest of the API works).

## 6. Security notes

- The signature is over `folder`, `public_id`, `overwrite=false`, `unique_filename=true`, `tags`, `timestamp`. The frontend cannot tamper with any of these without invalidating the signature.
- The signature expires after Cloudinary's default 1-hour window (timestamp-based). Frontends should request a fresh signature for each upload.
- Cloudinary's free tier (25 credits/month) is plenty for V1. Each credit ≈ 1 GB storage + 1 GB bandwidth.
- For abusive clients, add Cloudinary's "upload preset" restrictions in the Cloudinary dashboard: max file size, allowed MIME types, max dimensions. The signed params + the preset together enforce a defense-in-depth policy.
