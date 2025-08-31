// 커뮤니티 MVP 라우터 (테스트 버전)
// 2025-01-XX

import { Router } from 'express';

const router = Router();

// 테스트용 간단한 라우터 (라우터 로드 확인용)
router.get('/test', (req, res) => {
  res.json({ message: 'Community router loaded successfully!' });
});

// 피드 테스트
router.get('/feed', (req, res) => {
  res.json({ message: 'Feed endpoint working!' });
});

// 게시글 테스트
router.get('/posts', (req, res) => {
  res.json({ message: 'Posts endpoint working!' });
});

// 게시글 생성
router.post('/posts', (req, res) => {
  try {
    const { content, attachmentKeys, locationCode, hashtags } = req.body;
    
    // 간단한 게시글 생성 응답
    const post = {
      id: Date.now(),
      content,
      attachmentKeys: attachmentKeys || [],
      locationCode,
      hashtags: hashtags || [],
      createdAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      code: 'POST_CREATED',
      message: 'Post created successfully',
      data: { post }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to create post',
      data: null
    });
  }
});

export default router;
