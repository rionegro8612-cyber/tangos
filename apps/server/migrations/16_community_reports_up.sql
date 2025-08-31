-- 커뮤니티 MVP: reports 테이블 생성
-- 2025-01-XX

-- 신고 테이블
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id user_id_t NOT NULL REFERENCES users(id),
  target_type varchar(16) NOT NULL, -- 'post' | 'comment' | 'user'
  target_id uuid NOT NULL,
  reason_code varchar(32) NOT NULL,
  details text,
  status varchar(16) NOT NULL DEFAULT 'pending', -- pending|reviewed|actioned
  handled_by user_id_t REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);

-- 트리거 함수: updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trigger_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_reports_updated_at();
