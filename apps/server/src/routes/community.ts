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
    // 페이지네이션 파라미터 검증
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50); // 최대 50개로 제한
    const cursor = req.query.cursor as string | undefined;
    
    if (cursor && (typeof cursor !== 'string' || cursor.length === 0)) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'Invalid cursor format',
        data: null,
        requestId: (req as any).requestId ?? "",
      });
    }

    const result = await communityRepo.getFeed(limit, cursor);
    
    return res.ok({
      posts: result.posts,
      count: result.posts.length,
      limit,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore
    }, 'FEED_OK', 'Feed retrieved successfully');
  } catch (error) {
    console.error('[COMMUNITY] Feed error:', error);
    next(error);
  }
});

// 게시글 생성 (실제 데이터베이스 연동) - 인증 필수
router.post('/posts', authRequired, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, locationCode } = req.body;
    
    // 1. 필수 필드 검증
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'Content is required and must be a string',
        data: null,
        requestId: (req as any).requestId ?? "",
      });
    }

    const trimmedContent = content.trim();
    
    // 2. 본문 길이 검증 (최소 1자, 최대 2000자)
    if (trimmedContent.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'CONTENT_TOO_SHORT',
        message: 'Content cannot be empty',
        data: { minLength: 1 },
        requestId: (req as any).requestId ?? "",
      });
    }

    if (trimmedContent.length > 2000) {
      return res.status(400).json({
        success: false,
        code: 'CONTENT_TOO_LONG',
        message: 'Content exceeds maximum length',
        data: { maxLength: 2000, actualLength: trimmedContent.length },
        requestId: (req as any).requestId ?? "",
      });
    }

    // 3. 금칙어 검증 (간단한 예시)
    const forbiddenWords = ['spam', 'scam', 'fake', 'hate', 'abuse'];
    const lowerContent = trimmedContent.toLowerCase();
    const foundForbiddenWord = forbiddenWords.find(word => lowerContent.includes(word));
    
    if (foundForbiddenWord) {
      return res.status(400).json({
        success: false,
        code: 'CONTENT_VIOLATION',
        message: 'Content contains inappropriate language',
        data: { violationType: 'forbidden_word' },
        requestId: (req as any).requestId ?? "",
      });
    }

    // 4. locationCode 검증 (선택적)
    if (locationCode && typeof locationCode !== 'string') {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'Location code must be a string',
        data: null,
        requestId: (req as any).requestId ?? "",
      });
    }

    // 인증된 사용자 ID 사용 (authRequired 미들웨어에서 주입됨)
    const userId = String(req.user?.id);
    
    const postId = await communityRepo.createPost(userId, trimmedContent, locationCode);
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

// 게시글 목록 조회 (간단한 테스트용) - GET /posts/:id보다 먼저 정의
router.get('/posts', (req, res) => {
  res.json({ message: 'Posts endpoint working!' });
});

// 게시글 상세 조회 - 인증 선택적 (GET /posts 다음에 정의)
router.get('/posts/:id', authOptional, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const postId = req.params.id;
    
    if (!postId) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'Post ID is required',
        data: null,
        requestId: (req as any).requestId ?? "",
      });
    }

    const post = await communityRepo.getPostById(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
        data: null,
        requestId: (req as any).requestId ?? "",
      });
    }

    return res.ok({
      post
    }, 'POST_OK', 'Post retrieved successfully');
  } catch (error) {
    console.error('[COMMUNITY] Get post error:', error);
    next(error);
  }
});

export default router;
