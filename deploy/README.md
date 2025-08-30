# 원격 서버 배포 가이드

## 🚀 2) 원격 서버 1회 세팅

### 2-1. 필수 패키지 설치 (건너뛰기)
✅ **Docker 이미 설치됨** - 이 단계는 건너뛰기

### 2-2. 디렉토리/파일 구조

#### 서버에서 실행할 명령어:
```bash
# 디렉토리 생성
sudo mkdir -p /srv/tango
sudo mkdir -p /srv/tango/env

# 권한 설정 (선택사항)
sudo chown -R $USER:$USER /srv/tango
chmod 600 /srv/tango/env/.env.staging.*
chmod 600 /srv/tango/env/.env.prod.*
```

#### 업로드해야 할 파일들:
- `.env.staging.server` (백엔드용)
- `.env.staging.web` (프론트용)
- `docker-compose.staging.yml`

### 2-3. 업로드 방법

#### 방법 1: SCP로 업로드 (로컬에서)
```bash
scp ./env/.env.staging.server ubuntu@123.45.67.89:/srv/tango/env/
scp ./env/.env.staging.web    ubuntu@123.45.67.89:/srv/tango/env/
scp ./deploy/docker-compose.staging.yml ubuntu@123.45.67.89:/srv/tango/
```

#### 방법 2: 서버에서 직접 생성
```bash
sudo nano /srv/tango/env/.env.staging.server
sudo nano /srv/tango/env/.env.staging.web
sudo nano /srv/tango/docker-compose.staging.yml
```

### 2-4. 검증
```bash
docker --version
docker compose version
ls -la /srv/tango/
ls -la /srv/tango/env/
```
