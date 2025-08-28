import { Router, Request, Response } from "express";
import { logRetentionManager } from "../lib/log-retention";
import { auditLogger } from "../lib/audit";
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

// ===== 보존 정책 관리 엔드포인트 =====

/**
 * GET /retention/policy
 * 현재 보존 정책 조회
 */
router.get("/policy", (req: Request, res: Response) => {
  try {
    const policy = logRetentionManager.getRetentionPolicy();

    res.json({
      success: true,
      data: policy,
    });
  } catch (error) {
    console.error("[RETENTION] Error fetching retention policy:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "보존 정책 조회 중 오류가 발생했습니다.",
    });
  }
});

/**
 * PUT /retention/policy
 * 보존 정책 업데이트 (관리자 전용)
 */
router.put("/policy", requireAdmin, (req: Request, res: Response) => {
  try {
    const policyUpdate = req.body;

    // 정책 업데이트
    logRetentionManager.updateRetentionPolicy(policyUpdate);

    const updatedPolicy = logRetentionManager.getRetentionPolicy();

    res.json({
      success: true,
      data: {
        message: "보존 정책이 업데이트되었습니다.",
        policy: updatedPolicy,
      },
    });
  } catch (error) {
    console.error("[RETENTION] Error updating retention policy:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "보존 정책 업데이트 중 오류가 발생했습니다.",
    });
  }
});

// ===== 로그 수명주기 관리 엔드포인트 =====

/**
 * GET /retention/lifecycle/stats
 * 수명주기별 로그 통계 조회 (관리자 전용)
 */
router.get("/lifecycle/stats", requireAdmin, (req: Request, res: Response) => {
  try {
    const lifecycleStats = auditLogger.getLifecycleStats();

    res.json({
      success: true,
      data: lifecycleStats,
    });
  } catch (error) {
    console.error("[RETENTION] Error fetching lifecycle stats:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "수명주기 통계 조회 중 오류가 발생했습니다.",
    });
  }
});

/**
 * GET /retention/lifecycle/stage/:stage
 * 특정 수명주기 단계의 로그 조회 (관리자 전용)
 */
router.get("/lifecycle/stage/:stage", requireAdmin, (req: Request, res: Response) => {
  try {
    const { stage } = req.params;
    const { limit = "100", offset = "0" } = req.query;

    // 모든 로그에서 해당 단계 필터링
    const allLogs = auditLogger.getAllLogs();
    const stageLogs = allLogs.filter((log) => log.lifecycleStage === stage);

    // 페이지네이션
    const limitNum = parseInt(limit as string) || 100;
    const offsetNum = parseInt(offset as string) || 0;
    const paginatedLogs = stageLogs.slice(offsetNum, offsetNum + limitNum);

    // 민감정보 제거
    const sanitizedLogs = paginatedLogs.map((log) => sanitizeObject(log));

    res.json({
      success: true,
      data: {
        stage,
        logs: sanitizedLogs,
        pagination: {
          total: stageLogs.length,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < stageLogs.length,
        },
      },
    });
  } catch (error) {
    console.error("[RETENTION] Error fetching stage logs:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "단계별 로그 조회 중 오류가 발생했습니다.",
    });
  }
});

// ===== 로그 압축 및 샘플링 엔드포인트 =====

/**
 * GET /retention/compression/stats
 * 압축 및 샘플링 통계 조회 (관리자 전용)
 */
router.get("/compression/stats", requireAdmin, (req: Request, res: Response) => {
  try {
    const compressionStats = auditLogger.getCompressionStats();

    res.json({
      success: true,
      data: compressionStats,
    });
  } catch (error) {
    console.error("[RETENTION] Error fetching compression stats:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "압축 통계 조회 중 오류가 발생했습니다.",
    });
  }
});

/**
 * POST /retention/compression/apply
 * 로그 압축 적용 (관리자 전용)
 */
router.post("/compression/apply", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { stage } = req.body;

    if (!stage || !["warm", "cold"].includes(stage)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "유효한 단계를 지정해주세요 (warm 또는 cold)",
      });
    }

    // 해당 단계의 로그들 압축 적용
    const allLogs = auditLogger.getAllLogs();
    const stageLogs = allLogs.filter((log) => log.lifecycleStage === stage);

    let compressedCount = 0;
    let totalSizeReduction = 0;

    stageLogs.forEach((log) => {
      if (!log.compressed) {
        const originalSize = log.originalSize || JSON.stringify(log).length;
        const compressedLog = logRetentionManager.compressLog(log);
        const compressedSize = JSON.stringify(compressedLog).length;

        totalSizeReduction += originalSize - compressedSize;
        compressedCount++;
      }
    });

    res.json({
      success: true,
      data: {
        message: `${stage} 단계 로그 압축이 완료되었습니다.`,
        stage,
        compressedCount,
        totalSizeReduction,
        averageReduction: compressedCount > 0 ? totalSizeReduction / compressedCount : 0,
      },
    });
  } catch (error) {
    console.error("[RETENTION] Error applying compression:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "로그 압축 적용 중 오류가 발생했습니다.",
    });
  }
});

// ===== 로그 집계 엔드포인트 =====

/**
 * GET /retention/aggregation/hourly
 * 시간별 집계 로그 조회 (관리자 전용)
 */
router.get("/aggregation/hourly", requireAdmin, (req: Request, res: Response) => {
  try {
    const { limit = "100", offset = "0" } = req.query;

    const hourlyAggregations = auditLogger.getHourlyAggregations();

    // 페이지네이션
    const limitNum = parseInt(limit as string) || 100;
    const offsetNum = parseInt(offset as string) || 0;
    const paginatedAggregations = hourlyAggregations.slice(offsetNum, offsetNum + limitNum);

    res.json({
      success: true,
      data: {
        aggregations: paginatedAggregations,
        pagination: {
          total: hourlyAggregations.length,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < hourlyAggregations.length,
        },
      },
    });
  } catch (error) {
    console.error("[RETENTION] Error fetching hourly aggregations:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "시간별 집계 조회 중 오류가 발생했습니다.",
    });
  }
});

/**
 * GET /retention/aggregation/daily
 * 일별 집계 로그 조회 (관리자 전용)
 */
router.get("/aggregation/daily", requireAdmin, (req: Request, res: Response) => {
  try {
    const { limit = "100", offset = "0" } = req.query;

    const dailyAggregations = auditLogger.getDailyAggregations();

    // 페이지네이션
    const limitNum = parseInt(limit as string) || 100;
    const offsetNum = parseInt(offset as string) || 0;
    const paginatedAggregations = dailyAggregations.slice(offsetNum, offsetNum + limitNum);

    res.json({
      success: true,
      data: {
        aggregations: paginatedAggregations,
        pagination: {
          total: dailyAggregations.length,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < dailyAggregations.length,
        },
      },
    });
  } catch (error) {
    console.error("[RETENTION] Error fetching daily aggregations:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "일별 집계 조회 중 오류가 발생했습니다.",
    });
  }
});

/**
 * POST /retention/aggregation/generate
 * 집계 로그 생성 (관리자 전용)
 */
router.post("/aggregation/generate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type } = req.body;

    if (!type || !["hourly", "daily"].includes(type)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "유효한 집계 타입을 지정해주세요 (hourly 또는 daily)",
      });
    }

    // 모든 로그 가져와서 집계 생성
    const allLogs = auditLogger.getAllLogs();

    let aggregations: any[] = [];
    if (type === "hourly") {
      aggregations = logRetentionManager.aggregateHourlyLogs(allLogs);
    } else {
      aggregations = logRetentionManager.aggregateDailyLogs(allLogs);
    }

    res.json({
      success: true,
      data: {
        message: `${type} 집계 로그가 생성되었습니다.`,
        type,
        count: aggregations.length,
        aggregations: aggregations.slice(0, 5), // 처음 5개만 반환
      },
    });
  } catch (error) {
    console.error("[RETENTION] Error generating aggregations:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "집계 로그 생성 중 오류가 발생했습니다.",
    });
  }
});

// ===== 비용 최적화 엔드포인트 =====

/**
 * GET /retention/cost/analysis
 * 로그 비용 분석 (관리자 전용)
 */
router.get("/cost/analysis", requireAdmin, (req: Request, res: Response) => {
  try {
    const allLogs = auditLogger.getAllLogs();
    const costAnalysis = logRetentionManager.calculateLogCost(allLogs);

    // 단순화된 필드 정보
    const simplifiedFields = logRetentionManager.getSimplifiedFields();

    res.json({
      success: true,
      data: {
        costAnalysis,
        simplifiedFields: simplifiedFields.slice(0, 10), // 처음 10개만 반환
        recommendations: [
          "핫 로그는 7일 후 웜으로 이동하여 압축 적용",
          "웜 로그는 30일 후 콜드로 이동하여 더 강한 압축 적용",
          "에러 및 보안 로그는 항상 100% 보존",
          "일반 로그는 단계별로 샘플링 적용",
        ],
      },
    });
  } catch (error) {
    console.error("[RETENTION] Error analyzing costs:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "비용 분석 중 오류가 발생했습니다.",
    });
  }
});

/**
 * GET /retention/cost/optimization
 * 비용 최적화 제안 (관리자 전용)
 */
router.get("/cost/optimization", requireAdmin, (req: Request, res: Response) => {
  try {
    const allLogs = auditLogger.getAllLogs();
    const currentCost = logRetentionManager.calculateLogCost(allLogs);

    // 최적화 시나리오 계산
    const optimizationScenarios = [
      {
        name: "강화된 압축",
        description: "웜/콜드 로그에 더 강한 압축 적용",
        estimatedSavings: currentCost.totalCost * 0.15, // 15% 절약
        implementation: "압축 알고리즘 강화, 필드 단순화 강화",
      },
      {
        name: "적응형 샘플링",
        description: "트래픽에 따른 동적 샘플링 비율 조정",
        estimatedSavings: currentCost.totalCost * 0.1, // 10% 절약
        implementation: "시간대별, 이벤트별 샘플링 비율 최적화",
      },
      {
        name: "스마트 보존",
        description: "중요도 기반 보존 기간 조정",
        estimatedSavings: currentCost.totalCost * 0.2, // 20% 절약
        implementation: "이벤트 중요도에 따른 보존 기간 차등 적용",
      },
    ];

    res.json({
      success: true,
      data: {
        currentCost,
        optimizationScenarios,
        totalPotentialSavings: optimizationScenarios.reduce(
          (sum, scenario) => sum + scenario.estimatedSavings,
          0,
        ),
      },
    });
  } catch (error) {
    console.error("[RETENTION] Error generating optimization suggestions:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "최적화 제안 생성 중 오류가 발생했습니다.",
    });
  }
});

// ===== 시스템 상태 엔드포인트 =====

/**
 * GET /retention/status
 * 로그 보존 시스템 상태 확인
 */
router.get("/status", (req: Request, res: Response) => {
  try {
    const retentionStatus = logRetentionManager.getRetentionStatus();
    const lifecycleStats = auditLogger.getLifecycleStats();
    const compressionStats = auditLogger.getCompressionStats();

    res.json({
      success: true,
      data: {
        retention: retentionStatus,
        lifecycle: lifecycleStats,
        compression: compressionStats,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[RETENTION] Error fetching status:", error);
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
