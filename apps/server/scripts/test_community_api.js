#!/usr/bin/env node

/**
 * 커뮤니티 MVP API 테스트 스크립트
 * 2025-01-XX
 */

const axios = require('axios');
const fs = require('fs').promises;

// 환경변수 로드
require('dotenv').config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-id';

// 테스트용 쿠키 (실제 테스트 시에는 로그인 후 받은 쿠키 사용)
const TEST_COOKIES = {
  access_token: process.env.TEST_ACCESS_TOKEN || 'test-access-token'
};

class CommunityAPITester {
  constructor() {
    this.axios = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });
    
    // 쿠키 설정
    this.axios.defaults.headers.Cookie = Object.entries(TEST_COOKIES)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }

  async testFeed() {
    console.log('📱 피드 API 테스트...');
    
    try {
      const response = await this.axios.get('/feed?limit=5');
      console.log('✅ 피드 조회 성공:', response.data.success);
      console.log(`   게시글 수: ${response.data.data?.items?.length || 0}`);
      return true;
    } catch (error) {
      console.error('❌ 피드 조회 실패:', error.response?.data || error.message);
      return false;
    }
  }

  async testCreatePost() {
    console.log('✍️ 게시글 작성 API 테스트...');
    
    try {
      const postData = {
        content: '안녕하세요! 탱고 커뮤니티 MVP 테스트 게시글입니다. 🎉',
        attachmentKeys: [],
        hashtags: ['테스트', '커뮤니티', 'MVP']
      };

      const response = await this.axios.post('/posts', postData);
      console.log('✅ 게시글 작성 성공:', response.data.success);
      console.log(`   게시글 ID: ${response.data.data?.postId}`);
      return response.data.data?.postId;
    } catch (error) {
      console.error('❌ 게시글 작성 실패:', error.response?.data || error.message);
      return null;
    }
  }

  async testGetPost(postId) {
    if (!postId) return false;
    
    console.log('📖 게시글 상세 조회 API 테스트...');
    
    try {
      const response = await this.axios.get(`/posts/${postId}`);
      console.log('✅ 게시글 조회 성공:', response.data.success);
      console.log(`   제목: ${response.data.data?.content?.substring(0, 30)}...`);
      return true;
    } catch (error) {
      console.error('❌ 게시글 조회 실패:', error.response?.data || error.message);
      return false;
    }
  }

  async testPostLike(postId) {
    if (!postId) return false;
    
    console.log('👍 게시글 좋아요 API 테스트...');
    
    try {
      const response = await this.axios.post(`/posts/${postId}/like`);
      console.log('✅ 게시글 좋아요 성공:', response.data.success);
      console.log(`   좋아요 상태: ${response.data.data?.liked ? '좋아요' : '좋아요 취소'}`);
      console.log(`   좋아요 수: ${response.data.data?.likeCount}`);
      return true;
    } catch (error) {
      console.error('❌ 게시글 좋아요 실패:', error.response?.data || error.message);
      return false;
    }
  }

  async testCreateComment(postId) {
    if (!postId) return false;
    
    console.log('💬 댓글 작성 API 테스트...');
    
    try {
      const commentData = {
        post_id: postId,
        content: '멋진 게시글이네요! 👍',
        parent_comment_id: undefined
      };

      const response = await this.axios.post('/comments', commentData);
      console.log('✅ 댓글 작성 성공:', response.data.success);
      console.log(`   댓글 ID: ${response.data.data?.commentId}`);
      return response.data.data?.commentId;
    } catch (error) {
      console.error('❌ 댓글 작성 실패:', error.response?.data || error.message);
      return null;
    }
  }

  async testGetComments(postId) {
    if (!postId) return false;
    
    console.log('📝 댓글 목록 조회 API 테스트...');
    
    try {
      const response = await this.axios.get(`/posts/${postId}/comments?limit=10`);
      console.log('✅ 댓글 조회 성공:', response.data.success);
      console.log(`   댓글 수: ${response.data.data?.length || 0}`);
      return true;
    } catch (error) {
      console.error('❌ 댓글 조회 실패:', error.response?.data || error.message);
      return false;
    }
  }

  async testUploadPresign() {
    console.log('📤 업로드 사전서명 API 테스트...');
    
    try {
      const uploadData = {
        files: [
          {
            name: 'test-image.jpg',
            mime: 'image/jpeg',
            size: 1024 * 1024 // 1MB
          }
        ]
      };

      const response = await this.axios.post('/upload/presign', uploadData);
      console.log('✅ 업로드 사전서명 성공:', response.data.success);
      console.log(`   발급된 키: ${response.data.data?.results?.[0]?.key}`);
      return true;
    } catch (error) {
      console.error('❌ 업로드 사전서명 실패:', error.response?.data || error.message);
      return false;
    }
  }

  async testFollowUser() {
    console.log('👥 사용자 팔로우 API 테스트...');
    
    try {
      const targetUserId = 'test-target-user-id'; // 실제 테스트 시에는 존재하는 사용자 ID 사용
      const response = await this.axios.post(`/follow/${targetUserId}`);
      console.log('✅ 팔로우 성공:', response.data.success);
      return true;
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('ℹ️ 이미 팔로우 중인 사용자입니다');
        return true;
      }
      console.error('❌ 팔로우 실패:', error.response?.data || error.message);
      return false;
    }
  }

  async testReportPost(postId) {
    if (!postId) return false;
    
    console.log('🚨 게시글 신고 API 테스트...');
    
    try {
      const reportData = {
        reason_code: 'spam',
        details: '테스트를 위한 신고입니다.'
      };

      const response = await this.axios.post(`/posts/${postId}/report`, reportData);
      console.log('✅ 신고 성공:', response.data.success);
      console.log(`   신고 ID: ${response.data.data?.reportId}`);
      return true;
    } catch (error) {
      console.error('❌ 신고 실패:', error.response?.data || error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 커뮤니티 MVP API 테스트 시작\n');
    console.log(`📍 테스트 대상: ${BASE_URL}\n`);

    const results = {
      feed: false,
      createPost: false,
      getPost: false,
      postLike: false,
      createComment: false,
      getComments: false,
      uploadPresign: false,
      followUser: false,
      reportPost: false
    };

    // 1. 피드 테스트
    results.feed = await this.testFeed();
    console.log('');

    // 2. 게시글 작성 테스트
    const postId = await this.testCreatePost();
    results.createPost = !!postId;
    console.log('');

    // 3. 게시글 조회 테스트
    results.getPost = await this.testGetPost(postId);
    console.log('');

    // 4. 게시글 좋아요 테스트
    results.postLike = await this.testPostLike(postId);
    console.log('');

    // 5. 댓글 작성 테스트
    const commentId = await this.testCreateComment(postId);
    results.createComment = !!commentId;
    console.log('');

    // 6. 댓글 목록 조회 테스트
    results.getComments = await this.testGetComments(postId);
    console.log('');

    // 7. 업로드 사전서명 테스트
    results.uploadPresign = await this.testUploadPresign();
    console.log('');

    // 8. 사용자 팔로우 테스트
    results.followUser = await this.testFollowUser();
    console.log('');

    // 9. 게시글 신고 테스트
    results.reportPost = await this.testReportPost(postId);
    console.log('');

    // 결과 요약
    this.printResults(results);
  }

  printResults(results) {
    console.log('📊 테스트 결과 요약');
    console.log('==================');
    
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(Boolean).length;
    const failedTests = totalTests - passedTests;

    console.log(`총 테스트: ${totalTests}`);
    console.log(`✅ 통과: ${passedTests}`);
    console.log(`❌ 실패: ${failedTests}`);
    console.log('');

    Object.entries(results).forEach(([testName, passed]) => {
      const status = passed ? '✅' : '❌';
      const testDisplayName = this.getTestDisplayName(testName);
      console.log(`${status} ${testDisplayName}`);
    });

    console.log('');
    if (failedTests === 0) {
      console.log('🎉 모든 테스트가 통과했습니다!');
    } else {
      console.log('💥 일부 테스트가 실패했습니다.');
    }
  }

  getTestDisplayName(testName) {
    const names = {
      feed: '피드 조회',
      createPost: '게시글 작성',
      getPost: '게시글 조회',
      postLike: '게시글 좋아요',
      createComment: '댓글 작성',
      getComments: '댓글 목록 조회',
      uploadPresign: '업로드 사전서명',
      followUser: '사용자 팔로우',
      reportPost: '게시글 신고'
    };
    return names[testName] || testName;
  }
}

// 스크립트 실행
async function main() {
  try {
    const tester = new CommunityAPITester();
    await tester.runAllTests();
  } catch (error) {
    console.error('💥 테스트 실행 중 오류 발생:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { CommunityAPITester };
























