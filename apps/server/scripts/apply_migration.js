const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/tango'
});

async function applyMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Users 테이블 프로필 필드 마이그레이션 시작...\n');
    
    // UP 마이그레이션 실행
    const upMigration = fs.readFileSync(
      path.join(__dirname, '../migrations/10_users_profile_fields_up.sql'), 
      'utf8'
    );
    
    console.log('📝 마이그레이션 SQL:');
    console.log('─'.repeat(60));
    console.log(upMigration);
    console.log('─'.repeat(60));
    
    await client.query('BEGIN');
    
    console.log('\n🔧 마이그레이션 실행 중...');
    await client.query(upMigration);
    
    await client.query('COMMIT');
    console.log('✅ 마이그레이션이 성공적으로 완료되었습니다!');
    
    // 마이그레이션 후 스키마 확인
    console.log('\n🔍 마이그레이션 후 스키마 확인:');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('nickname', 'region_code', 'region_label', 'region_lat', 'region_lng')
      ORDER BY column_name;
    `);
    
    console.log('─'.repeat(60));
    result.rows.forEach(col => {
      console.log(`${col.column_name.padEnd(15)} | ${col.data_type.padEnd(20)} | ${col.is_nullable}`);
    });
    console.log('─'.repeat(60));
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 마이그레이션 실패:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch(console.error);
