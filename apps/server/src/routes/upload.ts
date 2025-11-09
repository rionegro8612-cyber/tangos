// 업로드 라우터 (MinIO 연동)
// 2025-01-XX

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// MinIO 클라이언트 설정
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'tango';

// 버킷 존재 확인 및 생성
async function ensureBucketExists() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`✅ MinIO bucket '${BUCKET_NAME}' created`);
    }
  } catch (error) {
    console.error('❌ MinIO bucket setup failed:', error);
    console.warn('⚠️ File upload features may not work without MinIO');
    console.warn('   To fix: Start MinIO locally or set MINIO_* env variables');
  }
}

// 서버 시작 시 버킷 확인
ensureBucketExists();

// 파일 확장자 검증
function validateFileType(fileName: string, allowedTypes: string[]): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension ? allowedTypes.includes(extension) : false;
}

// MIME 타입 검증
function validateMimeType(mimeType: string, allowedMimeTypes: string[]): boolean {
  return allowedMimeTypes.includes(mimeType);
}

// 🆕 Presigned URL 생성 엔드포인트
router.post('/presign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileName, fileType } = req.body;

    // 입력 검증
    if (!fileName || !fileType) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'fileName and fileType are required',
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 허용된 파일 타입 검증
    const allowedImageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp'
    ];

    if (!validateFileType(fileName, allowedImageTypes) || 
        !validateMimeType(fileType, allowedMimeTypes)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_FILE_TYPE',
        message: 'Only image files (jpg, jpeg, png, gif, webp) are allowed',
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 고유한 파일명 생성
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const objectName = `uploads/${uniqueFileName}`;

    // Presigned URL 생성 (7일 유효)
    const presignedUrl = await minioClient.presignedPutObject(
      BUCKET_NAME,
      objectName,
      7 * 24 * 60 * 60 // 7일
    );

    // 업로드 완료 후 접근할 수 있는 URL
    const publicUrl = `${process.env.MINIO_PUBLIC_URL || `http://localhost:9000`}/${BUCKET_NAME}/${objectName}`;

    return res.ok({
      uploadUrl: presignedUrl,
      publicUrl: publicUrl,
      objectName: objectName,
      fileName: uniqueFileName,
      expiresIn: 7 * 24 * 60 * 60, // 7일 (초 단위)
    }, 'PRESIGN_OK', 'Presigned URL generated successfully');

  } catch (error) {
    console.error('[UPLOAD] Presign error:', error);
    next(error);
  }
});

// 🆕 파일 업로드 상태 확인 엔드포인트
router.get('/status/:objectName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { objectName } = req.params;

    if (!objectName) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'objectName parameter is required',
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 객체 존재 확인
    try {
      await minioClient.statObject(BUCKET_NAME, objectName);
      
      // 공개 URL 생성
      const publicUrl = `${process.env.MINIO_PUBLIC_URL || `http://localhost:9000`}/${BUCKET_NAME}/${objectName}`;
      
      return res.ok({
        exists: true,
        objectName: objectName,
        publicUrl: publicUrl,
      }, 'FILE_EXISTS', 'File exists and is accessible');

    } catch (statError) {
      return res.ok({
        exists: false,
        objectName: objectName,
      }, 'FILE_NOT_FOUND', 'File does not exist');
    }

  } catch (error) {
    console.error('[UPLOAD] Status check error:', error);
    next(error);
  }
});

// 🆕 파일 삭제 엔드포인트 (관리자용)
router.delete('/:objectName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { objectName } = req.params;

    if (!objectName) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'objectName parameter is required',
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 객체 삭제
    await minioClient.removeObject(BUCKET_NAME, objectName);

    return res.ok({
      objectName: objectName,
      deleted: true,
    }, 'FILE_DELETED', 'File deleted successfully');

  } catch (error) {
    console.error('[UPLOAD] Delete error:', error);
    next(error);
  }
});

export default router;