#!/bin/bash

# 원격 서버 배포 스크립트
# 사용법: ./deploy.sh [staging|prod] [server_ip]

set -e

ENVIRONMENT=${1:-staging}
SERVER_IP=${2:-"123.45.67.89"}
USER=${3:-"ubuntu"}

echo "🚀 Tango 배포 시작: $ENVIRONMENT 환경 -> $SERVER_IP"

# 환경별 설정
if [ "$ENVIRONMENT" = "staging" ]; then
    COMPOSE_FILE="docker-compose.staging.yml"
    ENV_SERVER=".env.staging.server"
    ENV_WEB=".env.staging.web"
elif [ "$ENVIRONMENT" = "prod" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    ENV_SERVER=".env.prod.server"
    ENV_WEB=".env.prod.web"
else
    echo "❌ 잘못된 환경: $ENVIRONMENT (staging 또는 prod)"
    exit 1
fi

echo "📁 파일 업로드 중..."

# 서버에 디렉토리 생성
ssh $USER@$SERVER_IP "sudo mkdir -p /srv/tango/env"

# 환경 파일 업로드
scp ./env/$ENV_SERVER $USER@$SERVER_IP:/srv/tango/env/
scp ./env/$ENV_WEB $USER@$SERVER_IP:/srv/tango/env/

# Docker Compose 파일 업로드
scp ./deploy/$COMPOSE_FILE $USER@$SERVER_IP:/srv/tango/docker-compose.yml

# 권한 설정
ssh $USER@$SERVER_IP "sudo chown -R $USER:$USER /srv/tango && chmod 600 /srv/tango/env/.env.*"

echo "🔧 서버에서 배포 실행 중..."

# 서버에서 Docker Compose 실행
ssh $USER@$SERVER_IP "cd /srv/tango && docker compose down && docker compose up -d --build"

echo "✅ 배포 완료!"
echo "🌐 서버 상태 확인: ssh $USER@$SERVER_IP 'cd /srv/tango && docker compose ps'"
echo "📊 로그 확인: ssh $USER@$SERVER_IP 'cd /srv/tango && docker compose logs -f'"
