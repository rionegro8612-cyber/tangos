// 커뮤니티 MVP 라우터
// 2025-01-XX

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { communityRepo } from '../repos/communityRepo';
import { authRequired, authOptional } from '../middlewares/auth';
const router = Router();

console.log("🔧 Community router loaded successfully!");

// 테스트용 간단한 라우터 (라우터 로드 확인용)
router.get('/test', (req, res) => {
  res.json({ message: 'Community router loaded successfully!' });
});

// 피드 조회 (실제 데이터베이스 연동) - 인증 선택적
router.get('/feed', authOptional, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const posts = await communityRepo.getFeed(limit);
    
    return res.ok({
      posts,
      count: posts.length,
      limit
    }, 'FEED_OK', 'Feed retrieved successfully');
  } catch (error) {
    console.error('[COMMUNITY] Feed error:', error);
    next(error);
  }
});

// 게시글 테스트
router.get('/posts', (req, res) => {
  res.json({ message: 'Posts endpoint working!' });
});

// 게시글 생성 (실제 데이터베이스 연동) - 인증 필수
router.post('/posts', authRequired, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, locationCode } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'Content is required',
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 인증된 사용자 ID 사용 (authRequired 미들웨어에서 주입됨)
    const userId = String(req.user?.id || "1");
    
    const postId = await communityRepo.createPost(userId, content, locationCode);
    const post = await communityRepo.getPostById(postId);
    
    return res.ok({
      post,
      postId
    }, 'POST_CREATED', 'Post created successfully');
  } catch (error) {
    console.error('[COMMUNITY] Create post error:', error);
    next(error);
  }
});

export default router;
