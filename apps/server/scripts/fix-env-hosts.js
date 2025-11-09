// .env 파일의 Docker 호스트명을 localhost로 변경하는 스크립트
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env 파일을 찾을 수 없습니다.');
  process.exit(1);
}

let content = fs.readFileSync(envPath, 'utf8');
let changed = false;

// Redis URL 변경
if (content.includes('REDIS_URL=redis://redis:6379')) {
  content = content.replace(/REDIS_URL=redis:\/\/redis:6379/g, 'REDIS_URL=redis://localhost:6379');
  changed = true;
  console.log('✅ REDIS_URL: redis://redis:6379 → redis://localhost:6379');
}

// Redis Host 변경
if (content.includes('REDIS_HOST=redis')) {
  content = content.replace(/REDIS_HOST=redis/g, 'REDIS_HOST=localhost');
  changed = true;
  console.log('✅ REDIS_HOST: redis → localhost');
}

// Database URL 변경 (postgres 호스트명)
content = content.replace(/@postgres:/g, '@localhost:');
if (content.includes('@postgres:')) {
  changed = true;
  console.log('✅ DATABASE_URL: postgres 호스트 → localhost');
}

// DB_HOST 변경
if (content.includes('DB_HOST=postgres')) {
  content = content.replace(/DB_HOST=postgres/g, 'DB_HOST=localhost');
  changed = true;
  console.log('✅ DB_HOST: postgres → localhost');
}

if (changed) {
  fs.writeFileSync(envPath, content);
  console.log('\n✅ .env 파일 업데이트 완료!');
  console.log('   이제 서버를 다시 시작하세요: npm run dev');
} else {
  console.log('✅ 이미 올바르게 설정되어 있습니다.');
}


