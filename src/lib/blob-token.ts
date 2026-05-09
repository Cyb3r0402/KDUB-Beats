export const BLOB_READ_WRITE_TOKEN_ENV_NAMES = "Store_READ_WRITE_TOKEN or BLOB_READ_WRITE_TOKEN";

export function getBlobReadWriteToken() {
  return (
    process.env.Store_READ_WRITE_TOKEN ||
    process.env.STORE_READ_WRITE_TOKEN ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    ""
  );
}

export function hasBlobReadWriteToken() {
  return Boolean(getBlobReadWriteToken());
}
