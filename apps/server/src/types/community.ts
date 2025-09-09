// 커뮤니티 MVP 타입 정의
// 2025-01-XX

export interface Post {
  id: string;
  user_id: string;
  content: string;
  location_code?: string;
  like_count: number;
  comment_count: number;
  images_count: number;
  visibility: 'public' | 'neighbors';
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface PostImage {
  id: string;
  post_id: string;
  url: string;
  key: string;
  width?: number;
  height?: number;
  ord: number;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id?: string;
  content: string;
  like_count: number;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface PostLike {
  post_id: string;
  user_id: string;
  created_at: Date;
}

export interface CommentLike {
  comment_id: string;
  user_id: string;
  created_at: Date;
}

export interface Follow {
  follower_id: string;
  followee_id: string;
  created_at: Date;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  created_at: Date;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: 'post' | 'comment' | 'user';
  target_id: string;
  reason_code: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'actioned';
  handled_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Hashtag {
  id: string;
  tag: string;
  created_at: Date;
}

export interface PostHashtag {
  post_id: string;
  hashtag_id: string;
}

export interface Upload {
  key: string;
  user_id: string;
  mime?: string;
  size?: number;
  status: 'issued' | 'uploaded' | 'linked';
  created_at: Date;
  updated_at: Date;
}

// API 요청/응답 타입
export interface CreatePostRequest {
  content: string;
  attachmentKeys: string[];
  locationCode?: string;
  hashtags?: string[];
}

export interface CreateCommentRequest {
  post_id: string;
  content: string;
  parent_comment_id?: string;
}

export interface FeedQuery {
  cursor?: string;
  limit?: number;
}

export interface FeedResponse {
  items: PostWithAuthor[];
  nextCursor?: string;
}

export interface PostWithAuthor extends Omit<Post, 'user_id'> {
  author: {
    id: string;
    nickname: string;
    avatarUrl?: string;
  };
  images: PostImage[];
  liked: boolean;
}

export interface CommentWithAuthor extends Omit<Comment, 'user_id'> {
  author: {
    id: string;
    nickname: string;
    avatarUrl?: string;
  };
  liked: boolean;
}

export interface CreateUploadRequest {
  files: Array<{
    name: string;
    mime: string;
    size: number;
  }>;
}

export interface UploadResponse {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
}

export interface CreateUploadResponse {
  results: UploadResponse[];
}

// 커서 페이징 타입
export interface CursorPagination {
  cursor?: string;
  limit: number;
}

export interface CursorData {
  timestamp: string;
  id: string;
}

// 신고 관련 타입
export interface CreateReportRequest {
  target_type: 'post' | 'comment' | 'user';
  target_id: string;
  reason_code: string;
  details?: string;
}

export type ReportReasonCode = 
  | 'spam' 
  | 'abuse' 
  | 'inappropriate' 
  | 'personal_info' 
  | 'other';












