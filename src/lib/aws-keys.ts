export type AwsKeyPair = {
  accessKeyId: string;
  secretAccessKey: string;
};

/** Pull static keys out of the local API config text. */
export function awsKeysFromText(text: string): AwsKeyPair | null {
  const accessKeyId = text.match(/accessKeyId:\s*['"]([^'"]+)['"]/)?.[1]?.trim();
  const secretAccessKey = text
    .match(/secretAccessKey:\s*['"]([^'"]+)['"]/)?.[1]
    ?.trim();
  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey };
}
