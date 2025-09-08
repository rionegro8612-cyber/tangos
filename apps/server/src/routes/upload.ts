// 파일 업로드 라우터 (presign 포함)
import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// presign 엔드포인트 (파일 업로드 전 서명된 URL 생성)
router.post('/presign', async (req: Request, res: Response) => {
  try {
    const { files } = req.body as { files: Array<{ name: string; mime: string; size: number }> };
    
    if (!files || !Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'files array required',
        data: null
      });
    }

    // 간단한 presign 응답 (실제 S3 SDK 연동은 별도 구현 필요)
    const presignedUrls = files.map((file, index) => ({
      key: `uploads/${Date.now()}-${index}-${file.name}`,
      url: `http://localhost:9000/tango/uploads/${Date.now()}-${index}-${file.name}`,
      expiresIn: 300
    }));

    return res.json({
      success: true,
      code: 'PRESIGN_OK',
      message: 'Presigned URLs generated',
      data: {
        urls: presignedUrls
      }
    });
  } catch (error) {
    console.error('[UPLOAD] Presign error:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to generate presigned URLs',
      data: null
    });
  }
});

export default router;








