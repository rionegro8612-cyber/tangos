// 커뮤니티 MVP 리포지토리 (임시 비활성화)
// 2025-01-XX

// import { query } from '../lib/db';
// import {
//   Post,
//   PostImage,
//   Comment,
//   PostLike,
//   CommentLike,
//   Follow,
//   Block,
//   Report,
//   Hashtag,
//   PostHashtag,
//   Upload,
//   PostWithAuthor,
//   CommentWithAuthor,
//   CursorData,
//   FeedQuery
// } from '../types/community';

// export class CommunityRepo {
//   // === 게시글 관련 ===
  
//   async createPost(userId: string, content: string, locationCode?: string): Promise<string> {
//     const result = await query(
//       'INSERT INTO posts (user_id, content, location_code) VALUES ($1, $2, $3) RETURNING id',
//       [userId, content, locationCode]
//     );
//     return result.rows[0].id;
//   }

//   async getPostById(postId: string): Promise<Post | null> {
//     const result = await query(
//       'SELECT * FROM posts WHERE id = $1 AND deleted_at IS NULL',
//       [postId]
//     );
//     return result.rows[0] || null;
//   }

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
  
//   async getFeed(userId: string, query: FeedQuery): Promise<{ posts: PostWithAuthor[], nextCursor?: string }> {
//     const limit = Math.min(query.limit || 20, 50);
//     let cursorCondition = '';
//     let params: any[] = [userId, limit + 1];
//     let paramIndex = 3;

//     if (query.cursor) {
//       try {
//         const cursorData: CursorData = JSON.parse(Buffer.from(query.cursor, 'base64').toString());
//         cursorCondition = `AND (posts.created_at, posts.id) < ($${paramIndex}, $${paramIndex + 1})`;
//         params.push(cursorData.timestamp, cursorData.id);
//         paramIndex += 2;
//       } catch (e) {
//         // 잘못된 커서는 무시하고 최신부터 조회
//       }
//     }

//     const sql = `
//       SELECT DISTINCT posts.*, 
//              users.nickname as author_nickname,
//              users.avatar_url as author_avatar_url
//       FROM posts 
//       LEFT JOIN users ON posts.user_id = users.id
//       LEFT JOIN follows ON posts.user_id = follows.followee_id
//       WHERE posts.deleted_at IS NULL 
//         AND (posts.user_id = $1 OR follows.follower_id = $1)
//         ${cursorCondition}
//       ORDER BY posts.created_at DESC, posts.id DESC
//       LIMIT $2
//     `;

//     const result = await query(sql, params);
//     const posts = result.rows.slice(0, limit);
//     const hasMore = result.rows.length > limit;

//     // 다음 커서 생성
//     let nextCursor: string | undefined;
//     if (hasMore && posts.length > 0) {
//       const lastPost = posts[posts.length - 1];
//       const cursorData: CursorData = {
//         timestamp: lastPost.created_at.toISOString(),
//         id: lastPost.id
//       };
//       nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
//     }

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

// export const communityRepo = new CommunityRepo();




