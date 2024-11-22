import cloudinary, { UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
export function upload(
  file: string,
  publicId?: string,
  overwrite?: boolean,
  invalidate?: boolean
): Promise<UploadApiResponse | UploadApiErrorResponse | undefined> {
  return new Promise((resolve) => {
    cloudinary.v2.uploader.upload(
      file,
      { public_id: publicId, overwrite, invalidate },
      (err: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (err) {
          resolve(err);
        }
        resolve(result);
      }
    );
  });
}
