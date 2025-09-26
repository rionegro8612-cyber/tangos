// 커뮤니티 MVP 리포지토리
// 2025-01-XX

import { query } from '../lib/db';

// 간단한 타입 정의
interface Post {
  id: string;
  user_id: string;
  content: string;
  location_code?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

interface PostWithAuthor extends Post {
  author_nickname: string;
  author_profile_image?: string;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

interface CommentWithAuthor extends Comment {
  author_nickname: string;
  author_profile_image?: string;
}

export class CommunityRepo {
  // === 게시글 관련 ===
  
  async createPost(userId: string, content: string, locationCode?: string): Promise<string> {
    // userId를 bigint로 변환 (posts.user_id는 user_id_t 타입 = bigint)
    const userIdBigint = parseInt(userId, 10);
    
    if (isNaN(userIdBigint)) {
      throw new Error(`Invalid user ID: ${userId}`);
    }
    
    const result = await query(
      'INSERT INTO posts (user_id, content, location_code) VALUES ($1::bigint, $2, $3) RETURNING id',
      [userIdBigint, content, locationCode]
    );
    return result.rows[0].id;
  }

  async getPostById(postId: string): Promise<PostWithAuthor | null> {
    const result = await query(
      `SELECT posts.*, 
              users.nickname as author_nickname,
              users.avatar_url as author_profile_image
       FROM posts 
       LEFT JOIN users ON posts.user_id = users.id
       WHERE posts.id = $1 AND posts.deleted_at IS NULL`,
      [postId]
    );
    return result.rows[0] || null;
  }

//   async deletePost(postId: string, userId: string): Promise<boolean> {
//     const result = await query(
//       'UPDATE posts SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
//       [postId, userId]
//     );
//     return result.rowCount > 0;
//   }

//   async getPostsByUser(userId: string, limit = 20, offset = 0): Promise<Post[]> {
//     const result = await query(
//       'SELECT * FROM posts WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3',
//       [userId, limit, offset]
//     );
//     return result.rows;
//   }

//   // === 피드 관련 ===
  
  async getFeed(limit = 20, cursor?: string): Promise<{ posts: PostWithAuthor[]; nextCursor?: string; hasMore: boolean }> {
    let sql = `
      SELECT posts.*, 
             users.nickname as author_nickname,
             users.avatar_url as author_profile_image
      FROM posts 
      LEFT JOIN users ON posts.user_id = users.id
      WHERE posts.deleted_at IS NULL
    `;
    
    const params: any[] = [];
    
    // Cursor 기반 페이지네이션 (created_at 기준)
    if (cursor) {
      sql += ` AND posts.created_at < $1`;
      params.push(cursor);
    }
    
    sql += ` ORDER BY posts.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1); // hasMore 확인을 위해 +1

    const result = await query(sql, params);
    const posts = result.rows;
    
    // hasMore 확인
    const hasMore = posts.length > limit;
    if (hasMore) {
      posts.pop(); // 마지막 항목 제거
    }
    
    // nextCursor 생성 (마지막 post의 created_at)
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].created_at.toISOString() : undefined;
    
    return {
      posts,
      nextCursor,
      hasMore
    };
  }

//     // PostWithAuthor 형태로 변환
//     const postsWithAuthor: PostWithAuthor[] = await Promise.all(
//       posts.map(async (post) => {
//         const [images, liked] = await Promise.all([
//           this.getPostImages(post.id),
//           this.isPostLiked(post.id, userId)
//         ]);

//         return {
//           ...post,
//           author: {
//             id: post.user_id,
//             nickname: post.author_nickname,
//             avatarUrl: post.author_avatar_url
//           },
//           images,
//           liked
//         };
//       })
//     );

//     return { posts: postsWithAuthor, nextCursor };
//   }

//   // === 이미지 관련 ===
  
//   async createPostImages(postId: string, images: Array<{ url: string; key: string; width?: number; height?: number }>): Promise<void> {
//     if (images.length === 0) return;

//     const values = images.map((img, index) => 
//       `($1, $2, $3, $4, $5)`
//     ).join(', ');
    
//     const params = images.flatMap((img, index) => [
//       postId, img.url, img.key, img.width || null, img.height || null, index
//     ]);

//     await query(
//       `INSERT INTO post_images (post_id, url, key, width, height, ord) VALUES ${values}`,
//       params
//     );

//     // posts 테이블의 images_count 업데이트
//     await query(
//       'UPDATE posts SET images_count = $1 WHERE id = $2',
//       [images.length, postId]
//     );
//   }

//   async getPostImages(postId: string): Promise<PostImage[]> {
//     const result = await query(
//       'SELECT * FROM post_images WHERE post_id = $1 ORDER BY ord',
//       [postId]
//     );
//     return result.rows;
//   }

//   // === 댓글 관련 ===
  
//   async createComment(userId: string, postId: string, content: string, parentCommentId?: string): Promise<string> {
//     const result = await query(
//       'INSERT INTO comments (user_id, post_id, content, parent_comment_id) VALUES ($1, $2, $3, $4) RETURNING id',
//       [userId, postId, content, parentCommentId]
//     );

//     // posts 테이블의 comment_count 업데이트
//     await query(
//       'UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1',
//       [postId]
//     );

//     return result.rows[0].id;
//   }

//   async getCommentsByPost(postId: string, limit = 20, offset = 0): Promise<CommentWithAuthor[]> {
//     const result = await query(
//       `SELECT c.*, u.nickname as author_nickname, u.avatar_url as author_avatar_url
//        FROM comments c
//        LEFT JOIN users u ON c.user_id = u.id
//        WHERE c.post_id = $1 AND c.deleted_at IS NULL
//        ORDER BY c.created_at ASC, c.id ASC
//        LIMIT $2 OFFSET $3`,
//       [postId, limit, offset]
//     );

//     // CommentWithAuthor 형태로 변환
//     const commentsWithAuthor: CommentWithAuthor[] = await Promise.all(
//       result.rows.map(async (comment) => {
//         const liked = await this.isCommentLiked(comment.id, comment.user_id);
//         return {
//           ...comment,
//           author: {
//             id: comment.user_id,
//             nickname: comment.author_nickname,
//             avatarUrl: comment.author_avatar_url
//           },
//           liked
//         };
//       })
//     );

//     return commentsWithAuthor;
//   }

//   async deleteComment(commentId: string, userId: string): Promise<boolean> {
//     const result = await query(
//       'UPDATE comments SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
//       [commentId, userId]
//     );
    
//     if (result.rowCount > 0) {
//       // posts 테이블의 comment_count 감소
//       await query(
//         'UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = (SELECT post_id FROM comments WHERE id = $1)',
//         [commentId]
//       );
//     }

//     return result.rowCount > 0;
//   }

//   // === 좋아요 관련 ===
  
//   async togglePostLike(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
//     // 현재 좋아요 상태 확인
//     const existing = await query(
//       'SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2',
//       [postId, userId]
//     );

//     if (existing.rowCount > 0) {
//       // 좋아요 취소
//       await query(
//         'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
//         [postId, userId]
//       );
      
//       await query(
//         'UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1',
//         [postId]
//       );

//       const result = await query('SELECT like_count FROM posts WHERE id = $1', [postId]);
//       return { liked: false, likeCount: result.rows[0].like_count };
//     } else {
//       // 좋아요 추가
//       await query(
//         'INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)',
//         [postId, userId]
//       );
      
//       await query(
//         'UPDATE posts SET like_count = like_count + 1 WHERE id = $1',
//         [postId]
//       );

//       const result = await query('SELECT like_count FROM posts WHERE id = $1', [postId]);
//       return { liked: true, likeCount: result.rows[0].like_count };
//     }
//   }

//   async toggleCommentLike(commentId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
//     const existing = await query(
//       'SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
//       [commentId, userId]
//     );

//     if (existing.rowCount > 0) {
//       await query(
//         'DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
//         [commentId, userId]
//       );
      
//       await query(
//         'UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1',
//         [commentId]
//       );

//       const result = await query('SELECT like_count FROM comments WHERE id = $1', [commentId]);
//       return { liked: false, likeCount: result.rows[0].like_count };
//     } else {
//       await query(
//         'INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)',
//         [commentId, userId]
//       );
      
//       await query(
//         'UPDATE comments SET like_count = like_count + 1 WHERE id = $1',
//         [commentId]
//       );

//       const result = await query('SELECT like_count FROM comments WHERE id = $1', [commentId]);
//       return { liked: true, likeCount: result.rows[0].like_count };
//     }
//   }

//   async isPostLiked(postId: string, userId: string): Promise<boolean> {
//     const result = await query(
//       'SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2',
//       [postId, userId]
//     );
//     return result.rowCount > 0;
//   }

//   async isCommentLiked(commentId: string, userId: string): Promise<boolean> {
//     const result = await query(
//       'SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
//       [commentId, userId]
//     );
//     return result.rowCount > 0;
//   }

//   // === 팔로우 관련 ===
  
//   async followUser(followerId: string, followeeId: string): Promise<boolean> {
//     try {
//       await query(
//         'INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)',
//         [followerId, followeeId]
//       );
//       return true;
//     } catch (e: any) {
//       if (e.code === '23505') { // unique_violation
//         return false; // 이미 팔로우 중
//       }
//       throw e;
//     }
//   }

//   async unfollowUser(followerId: string, followeeId: string): Promise<boolean> {
//     const result = await query(
//       'DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2',
//       [followerId, followeeId]
//     );
//     return result.rowCount > 0;
//   }

//   async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
//     const result = await query(
//       'SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2',
//       [followerId, followeeId]
//     );
//     return result.rowCount > 0;
//   }

//   async getFollowers(userId: string, limit = 20, offset = 0): Promise<Array<{ id: string; nickname: string; avatarUrl?: string }>> {
//     const result = await query(
//       `SELECT u.id, u.nickname, u.avatar_url
//        FROM follows f
//        LEFT JOIN users u ON f.follower_id = u.id
//        WHERE f.followee_id = $1
//        ORDER BY f.created_at DESC
//        LIMIT $2 OFFSET $3`,
//       [userId, limit, offset]
//     );
//     return result.rows.map(row => ({
//       id: row.id,
//       nickname: row.nickname,
//       avatarUrl: row.avatar_url
//     }));
//   }

//   async getFollowing(userId: string, limit = 20, offset = 0): Promise<Array<{ id: string; nickname: string; avatarUrl?: string }>> {
//     const result = await query(
//       `SELECT u.id, u.nickname, u.avatar_url
//        FROM follows f
//        LEFT JOIN users u ON f.followee_id = u.id
//        WHERE f.follower_id = $1
//        ORDER BY f.created_at DESC
//        LIMIT $2 OFFSET $3`,
//       [userId, limit, offset]
//     );
//     return result.rows.map(row => ({
//       id: row.id,
//       nickname: row.nickname,
//       avatarUrl: row.avatar_url
//     }));
//   }

//   // === 차단 관련 ===
  
//   async blockUser(blockerId: string, blockedId: string): Promise<boolean> {
//     try {
//       await query(
//         'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)',
//         [blockerId, blockedId]
//       );
//       return true;
//     } catch (e: any) {
//       if (e.code === '23505') {
//         return false; // 이미 차단 중
//       }
//       throw e;
//     }
//   }

//   async unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
//     const result = await query(
//       'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
//       [blockerId, blockedId]
//     );
//     return result.rowCount > 0;
//   }

//   async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
//     const result = await query(
//       'SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
//       [blockerId, blockedId]
//     );
//     return result.rowCount > 0;
//   }

//   // === 신고 관련 ===
  
//   async createReport(reporterId: string, targetType: string, targetId: string, reasonCode: string, details?: string): Promise<string> {
//     const result = await query(
//       'INSERT INTO reports (reporter_id, target_type, target_id, reason_code, details) VALUES ($1, $2, $3, $4, $5) RETURNING id',
//       [reporterId, targetType, targetId, reasonCode, details]
//     );
//     return result.rows[0].id;
//   }

//   // === 해시태그 관련 ===
  
//   async createOrGetHashtag(tag: string): Promise<string> {
//     // 기존 해시태그 확인
//     let result = await query(
//       'SELECT id FROM hashtags WHERE tag = $1',
//       [tag]
//     );

//     if (result.rowCount > 0) {
//       return result.rows[0].id;
//     }

//     // 새 해시태그 생성
//     result = await query(
//       'INSERT INTO hashtags (tag) VALUES ($1) RETURNING id',
//       [tag]
//     );
//     return result.rows[0].id;
//   }

//   async linkHashtagsToPost(postId: string, hashtagIds: string[]): Promise<void> {
//     if (hashtagIds.length === 0) return;

//     const values = hashtagIds.map(() => '($1, $2)').join(', ');
//     const params = hashtagIds.flatMap(hashtagId => [postId, hashtagId]);

//     await query(
//       `INSERT INTO post_hashtags (post_id, hashtag_id) VALUES ${values}`,
//       params
//     );
//   }

//   // === 업로드 관련 ===
  
//   async createUpload(key: string, userId: string, mime?: string, size?: number): Promise<void> {
//     await query(
//       'INSERT INTO uploads (key, user_id, mime, size) VALUES ($1, $2, $3, $4)',
//       [key, userId, mime, size]
//     );
//   }

//   async updateUploadStatus(key: string, status: string): Promise<void> {
//     await query(
//       'UPDATE uploads SET status = $1, updated_at = now() WHERE key = $2',
//       [status, key]
//     );
//   }

//   async getUploadByKey(key: string): Promise<Upload | null> {
//     const result = await query(
//       'SELECT * FROM uploads WHERE key = $1',
//       [key]
//     );
//     return result.rows[0] || null;
//   }
// }

}

export const communityRepo = new CommunityRepo();




