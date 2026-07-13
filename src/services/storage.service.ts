import { PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { s3Client } from '../lib/s3';

export async function uploadContentResult(contentId: string, text: string): Promise<string> {
  const key = `content/${contentId}.txt`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: text,
      ContentType: 'text/plain',
    }),
  );

  return `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`;
}
