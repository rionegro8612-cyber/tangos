# GHCR 인증 가이드 (서버 쪽)

## 🚨 중요 포인트

GH Actions는 GITHUB_TOKEN으로 **이미지 "푸시"**를 합니다.
하지만 **서버에서 "풀"**하려면 다음 중 하나가 필요합니다:

## 🔓 옵션 A) 이미지를 Public으로 (간단하지만 권장 X)

GHCR 패키지(이미지)를 Public으로 만들면 서버에서 로그인 없이 pull 가능.
보안상 운영 이미지는 보통 Private 권장.

## 🔐 옵션 B) 서버에서 GHCR 로그인 (권장)

### 1. GitHub Personal Access Token 생성

1. **GitHub 설정**: Settings → Developer settings → Personal access tokens (classic)
2. **토큰 생성**: Generate new token (classic)
3. **권한 설정**: `read:packages` 체크 (필수)
4. **만료일 설정**: 적절한 만료일 설정 후 토큰 발급
5. **안전 저장**: 발급된 토큰을 안전한 곳에 저장

### 2. 서버에서 GHCR 로그인

```bash
# 서버에서 실행
echo "<YOUR_PAT>" | docker login ghcr.io -u <YOUR_GITHUB_USERNAME> --password-stdin
```

**성공 메시지**: `Login Succeeded`

### 3. 로그인 상태 확인

```bash
# 로그인 상태 확인
docker login ghcr.io

# 또는
cat ~/.docker/config.json | grep ghcr.io
```

## 📝 참고사항

- 이 로그인은 서버 로컬에 자격 증명을 캐싱합니다 (`~/.docker/config.json`)
- 이후 `docker compose pull` 시 Private 이미지도 정상 다운로드됩니다
- 토큰은 주기적으로 갱신하는 것을 권장합니다



































