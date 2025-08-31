#!/usr/bin/env node

/**
 * 커뮤니티 MVP 마이그레이션 실행 스크립트
 * 2025-01-XX
 */

const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// 환경변수 로드
require('dotenv').config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tango',
  ssl: process.env.DB_SSLMODE === 'require' ? { rejectUnauthorized: false } : false
};

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

async function getMigrationFiles() {
  // 실행할 마이그레이션 파일들 (순서 중요!)
  const migrationFiles = [
    '11_community_user_id_type_compat.sql',  // user_id 타입 호환성 도메인 생성
    '12_community_posts_up.sql',            // posts, post_images
    '13_community_comments_up.sql',         // comments
    '14_community_likes_up.sql',            // post_likes, comment_likes
    '15_community_follows_up.sql',          // follows, blocks
    '16_community_reports_up.sql',          // reports
    '17_community_hashtags_up.sql',         // hashtags, post_hashtags
    '18_community_uploads_up.sql'           // uploads
  ];
  
  return migrationFiles;
}

async function runMigration(client, filePath) {
  console.log(`🔄 실행 중: ${path.basename(filePath)}`);
  
  try {
    const sql = await fs.readFile(filePath, 'utf8');
    await client.query(sql);
    console.log(`✅ 완료: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.error(`❌ 실패: ${path.basename(filePath)}`);
    console.error(`   오류: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 커뮤니티 MVP 마이그레이션 시작\n');
  
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('📡 데이터베이스 연결 성공\n');
    
    const migrationFiles = await getMigrationFiles();
    console.log(`📋 실행할 마이그레이션 파일들:`);
    migrationFiles.forEach(file => console.log(`   - ${file}`));
    console.log('');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const file of migrationFiles) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const success = await runMigration(client, filePath);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
        break; // 실패 시 중단
      }
    }
    
    console.log('\n📊 마이그레이션 결과:');
    console.log(`   ✅ 성공: ${successCount}`);
    console.log(`   ❌ 실패: ${failCount}`);
    
    if (failCount === 0) {
      console.log('\n🎉 모든 커뮤니티 MVP 마이그레이션이 성공적으로 완료되었습니다!');
      console.log('\n📋 생성된 테이블들:');
      console.log('   - posts (게시글)');
      console.log('   - post_images (게시글 이미지)');
      console.log('   - comments (댓글)');
      console.log('   - post_likes (게시글 좋아요)');
      console.log('   - comment_likes (댓글 좋아요)');
      console.log('   - follows (팔로우)');
      console.log('   - blocks (차단)');
      console.log('   - reports (신고)');
      console.log('   - hashtags (해시태그)');
      console.log('   - post_hashtags (게시글-해시태그 연결)');
      console.log('   - uploads (업로드 메타데이터)');
    } else {
      console.log('\n💥 마이그레이션 중 오류가 발생했습니다.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 데이터베이스 연결 실패:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('💥 예상치 못한 오류:', error);
    process.exit(1);
  });
}

module.exports = { main };
