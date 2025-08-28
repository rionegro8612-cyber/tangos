import { Router, Request, Response } from "express";
import { auditLogger } from "../lib/audit";
import { piiManager } from "../lib/pii-management";
import { sanitizeObject } from "../lib/security";

const router = Router();

// ===== 미들웨어: 관리자 권한 확인 =====
const requireAdmin = (req: Request, res: Response, next: Function) => {
  // 🚨 실제 구현에서는 JWT 토큰 검증 및 관리자 권한 확인
  const isAdmin = req.headers["x-admin-token"] === process.env.ADMIN_TOKEN;

  if (!isAdmin) {
    return res.status(403).json({
      error: "Forbidden",
      message: "관리자 권한이 필요합니다.",
    });
  }

  next();
};

// ===== Audit 로그 조회 엔드포인트 =====

/**
 * GET /audit/logs
 * 모든 감사 로그 조회 (관리자 전용)
 */
router.get("/logs", requireAdmin, (req: Request, res: Response) => {
  try {
    const { userId, eventType, startDate, endDate, limit = "100", offset = "0" } = req.query;

    let logs = auditLogger.getAllLogs();

    // 사용자별 필터링
    if (userId && typeof userId === "string") {
      logs = logs.filter((log) => log.userId === userId);
    }

    // 이벤트 타입별 필터링
    if (eventType && typeof eventType === "string") {
      logs = logs.filter((log) => log.eventType === eventType);
    }

    // 날짜 범위 필터링
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      logs = logs.filter((log) => {
        const logDate = new Date(log.timestamp);
        return logDate >= start && logDate <= end;
      });
    }

    // 페이지네이션
    const limitNum = parseInt(limit as string) || 100;
    const offsetNum = parseInt(offset as string) || 0;
    const paginatedLogs = logs.slice(offsetNum, offsetNum + limitNum);

    // 민감정보 제거
    const sanitizedLogs = paginatedLogs.map((log) => sanitizeObject(log));

    res.json({
      success: true,
      data: {
        logs: sanitizedLogs,
        pagination: {
          total: logs.length,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < logs.length,
        },
      },
    });
  } catch (error) {
    console.error("[AUDIT] Error fetching logs:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "감사 로그 조회 중 오류가 발생했습니다.",
    });
  }
});

/**
 * GET /audit/logs/user/:userId
 * 특정 사용자의 감사 로그 조회 (관리자 전용)
 */
router.get("/logs/user/:userId", requireAdmin, (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = "100", offset = "0" } = req.query;

    const logs = auditLogger.getLogsByUser(userId);

    // 페이지네이션
    const limitNum = parseInt(limit as string) || 100;
    const offsetNum = parseInt(offset as string) || 0;
    const paginatedLogs = logs.slice(offsetNum, offsetNum + limitNum);

    // 민감정보 제거
    const sanitizedLogs = paginatedLogs.map((log) => sanitizeObject(log));

    res.json({
      success: true,
      data: {
        userId,
        logs: sanitizedLogs,
        pagination: {
          total: logs.length,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < logs.length,
        },
      },
    });
  } catch (error) {
    console.error("[AUDIT] Error fetching user logs:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "사용자 감사 로그 조회 중 오류가 발생했습니다.",
    });
  }
});

/**
 * GET /audit/logs/event/:eventType
 * 특정 이벤트 타입의 감사 로그 조회 (관리자 전용)
 */
router.get("/logs/event/:eventType", requireAdmin, (req: Request, res: Response) => {
  try {
    const { eventType } = req.params;
    const { limit = "100", offset = "0" } = req.query;

    const logs = auditLogger.getLogsByEventType(eventType as any);

    // 페이지네이션
    const limitNum = parseInt(limit as string) || 100;
    const offsetNum = parseInt(offset as string) || 0;
    const paginatedLogs = logs.slice(offsetNum, offsetNum + limitNum);

    // 민감정보 제거
    const sanitizedLogs = paginatedLogs.map((log) => sanitizeObject(log));

    res.json({
      success: true,
      data: {
        eventType,
        logs: sanitizedLogs,
        pagination: {
          total: logs.length,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < logs.length,
        },
      },
    });
  } catch (error) {
    console.error("[AUDIT] Error fetching event logs:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "이벤트 감사 로그 조회 중 오류가 발생했습니다.",
    });
  }
});

// ===== PII 관리 엔드포인트 =====

/**
 * POST /audit/pii/deletion
 * PII 삭제 요청 생성 (사용자 또는 관리자)
 */
router.post("/pii/deletion", async (req: Request, res: Response) => {
  try {
    const {
      userPhone,
      userEmail,
      userId,
      dataTypes,
      reason = "user_request",
      priority = "normal",
    } = req.body;

    const userIp = req.ip || req.connection.remoteAddress || "unknown";
    const requestId = (req.headers["x-request-id"] as string) || "unknown";

    // 필수 필드 검증
    if (!userPhone && !userEmail && !userId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "전화번호, 이메일, 또는 사용자 ID 중 하나는 필수입니다.",
      });
    }

    // PII 삭제 요청 생성
    const deletionRequest = piiManager.createDeletionRequest(
      requestId,
      userPhone,
      userEmail,
      userId,
      userIp,
      dataTypes,
      reason,
      priority,
    );

    res.status(201).json({
      success: true,
      data: {
        requestId: deletionRequest.id,
        status: deletionRequest.status,
        message: "PII 삭제 요청이 생성되었습니다.",
      },
    });
  } catch (error) {
    console.error("[AUDIT] Error creating PII deletion request:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "PII 삭제 요청 생성 중 오류가 발생했습니다.",
    });
  }
});

/**
 * POST /audit/pii/deletion/:requestId/process
 * PII 삭제 요청 처리 (관리자 전용)
 */
router.post(
  "/pii/deletion/:requestId/process",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;

      // PII 삭제 요청 처리
      const result = await piiManager.processDeletionRequest(requestId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("[AUDIT] Error processing PII deletion request:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "PII 삭제 요청 처리 중 오류가 발생했습니다.",
      });
    }
  },
);

/**
 * GET /audit/pii/deletion
 * PII 삭제 요청 목록 조회 (관리자 전용)
 */
router.get("/pii/deletion", requireAdmin, (req: Request, res: Response) => {
  try {
    const { status, userId, limit = "100", offset = "0" } = req.query;

    let requests = piiManager.getAllDeletionRequests();

    // 상태별 필터링
    if (status && typeof status === "string") {
      requests = requests.filter((req) => req.status === status);
    }

    // 사용자별 필터링
    if (userId && typeof userId === "string") {
      requests = requests.filter((req) => req.userId === userId);
    }

    // 페이지네이션
    const limitNum = parseInt(limit as string) || 100;
    const offsetNum = parseInt(offset as string) || 0;
    const paginatedRequests = requests.slice(offsetNum, offsetNum + limitNum);

    // 민감정보 제거
    const sanitizedRequests = paginatedRequests.map((req) => sanitizeObject(req));

    res.json({
      success: true,
      data: {
        requests: sanitizedRequests,
        pagination: {
          total: requests.length,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < requests.length,
        },
      },
    });
  } catch (error) {
    console.error("[AUDIT] Error fetching PII deletion requests:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "PII 삭제 요청 조회 중 오류가 발생했습니다.",
    });
  }
});

/**
 * GET /audit/pii/deletion/:requestId
 * 특정 PII 삭제 요청 조회 (관리자 전용)
 */
router.get("/pii/deletion/:requestId", requireAdmin, (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;

    const request = piiManager.getDeletionRequest(requestId);

    if (!request) {
      return res.status(404).json({
        error: "Not Found",
        message: "PII 삭제 요청을 찾을 수 없습니다.",
      });
    }

    // 민감정보 제거
    const sanitizedRequest = sanitizeObject(request);

    res.json({
      success: true,
      data: sanitizedRequest,
    });
  } catch (error) {
    console.error("[AUDIT] Error fetching PII deletion request:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "PII 삭제 요청 조회 중 오류가 발생했습니다.",
    });
  }
});

// ===== 시스템 상태 엔드포인트 =====

/**
 * GET /audit/status
 * Audit 시스템 상태 확인
 */
router.get("/status", (req: Request, res: Response) => {
  try {
    const auditStatus = auditLogger.getStatus();
    const piiStatus = piiManager.getStatus();

    res.json({
      success: true,
      data: {
        audit: auditStatus,
        pii: piiStatus,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[AUDIT] Error fetching status:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "시스템 상태 조회 중 오류가 발생했습니다.",
    });
  }
});

// ===== 에러 핸들링 =====

router.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: "요청한 엔드포인트를 찾을 수 없습니다.",
  });
});

export default router;
