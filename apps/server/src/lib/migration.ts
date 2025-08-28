// apps/server/src/lib/migration.ts
/**
 * 마이그레이션 운영 규칙
 * "스키마 추가 → 코드 배포 → 구필드 제거(2단계)"
 */

import { pool } from "./db";
import { StandardError, createError } from "./errorCodes";

export interface MigrationStep {
  id: string;
  name: string;
  sql: string;
  rollbackSql?: string;
  required: boolean;
  order: number;
}

export interface MigrationResult {
  success: boolean;
  stepId: string;
  message: string;
  executionTime: number;
  error?: string;
}

export interface MigrationPlan {
  version: string;
  steps: MigrationStep[];
  description: string;
  requiresDowntime: boolean;
}

/**
 * 마이그레이션 히스토리 테이블 생성
 */
async function ensureMigrationTable(): Promise<void> {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS migration_history (
      id SERIAL PRIMARY KEY,
      version VARCHAR(50) NOT NULL,
      step_id VARCHAR(100) NOT NULL,
      step_name VARCHAR(200) NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_time_ms INTEGER NOT NULL,
      success BOOLEAN NOT NULL,
      error_message TEXT,
      rollback_executed BOOLEAN DEFAULT FALSE,
      rollback_at TIMESTAMPTZ
    );
    
    CREATE INDEX IF NOT EXISTS idx_migration_history_version ON migration_history(version);
    CREATE INDEX IF NOT EXISTS idx_migration_history_step ON migration_history(step_id);
  `;

  await pool.query(createTableSql);
}

/**
 * 마이그레이션 단계 실행
 */
async function executeMigrationStep(step: MigrationStep): Promise<MigrationResult> {
  const startTime = Date.now();

  try {
    console.log(`[MIGRATION] Executing step: ${step.name}`);

    // SQL 실행
    await pool.query(step.sql);

    const executionTime = Date.now() - startTime;

    // 성공 기록
    await pool.query(
      `INSERT INTO migration_history 
       (version, step_id, step_name, execution_time_ms, success) 
       VALUES ($1, $2, $3, $4, $5)`,
      ["current", step.id, step.name, executionTime, true],
    );

    return {
      success: true,
      stepId: step.id,
      message: `Step ${step.name} executed successfully`,
      executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // 실패 기록
    await pool.query(
      `INSERT INTO migration_history 
       (version, step_id, step_name, execution_time_ms, success, error_message) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ["current", step.id, step.name, executionTime, false, errorMessage],
    );

    return {
      success: false,
      stepId: step.id,
      message: `Step ${step.name} failed`,
      executionTime,
      error: errorMessage,
    };
  }
}

/**
 * 마이그레이션 롤백
 */
async function rollbackMigrationStep(step: MigrationStep): Promise<MigrationResult> {
  if (!step.rollbackSql) {
    return {
      success: false,
      stepId: step.id,
      message: `No rollback SQL for step ${step.name}`,
      executionTime: 0,
      error: "Rollback SQL not provided",
    };
  }

  const startTime = Date.now();

  try {
    console.log(`[MIGRATION] Rolling back step: ${step.name}`);

    // 롤백 SQL 실행
    await pool.query(step.rollbackSql);

    const executionTime = Date.now() - startTime;

    // 롤백 기록
    await pool.query(
      `UPDATE migration_history 
       SET rollback_executed = true, rollback_at = NOW() 
       WHERE step_id = $1 AND success = false`,
      [step.id],
    );

    return {
      success: true,
      stepId: step.id,
      message: `Step ${step.name} rolled back successfully`,
      executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return {
      success: false,
      stepId: step.id,
      message: `Step ${step.name} rollback failed`,
      executionTime,
      error: errorMessage,
    };
  }
}

/**
 * 마이그레이션 계획 실행
 */
export async function executeMigrationPlan(plan: MigrationPlan): Promise<MigrationResult[]> {
  console.log(`[MIGRATION] Starting migration plan: ${plan.version}`);

  try {
    // 마이그레이션 테이블 확인
    await ensureMigrationTable();

    const results: MigrationResult[] = [];

    // 단계별 실행
    for (const step of plan.steps) {
      const result = await executeMigrationStep(step);
      results.push(result);

      if (!result.success) {
        console.error(`[MIGRATION] Step failed: ${step.name}`, result.error);

        // 필수 단계 실패 시 롤백
        if (step.required) {
          console.log(`[MIGRATION] Rolling back failed step: ${step.name}`);
          const rollbackResult = await rollbackMigrationStep(step);
          results.push(rollbackResult);

          // 롤백도 실패하면 중단
          if (!rollbackResult.success) {
            throw new Error(`Critical: Migration step ${step.name} failed and rollback failed`);
          }
        }

        // 선택적 단계는 계속 진행
        if (!step.required) {
          console.warn(`[MIGRATION] Non-required step failed, continuing: ${step.name}`);
        }
      }
    }

    console.log(`[MIGRATION] Migration plan completed: ${plan.version}`);
    return results;
  } catch (error) {
    console.error(`[MIGRATION] Migration plan failed: ${plan.version}`, error);
    throw error;
  }
}

/**
 * 마이그레이션 상태 확인
 */
export async function getMigrationStatus(): Promise<{
  version: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  lastExecuted: string | null;
  status: "pending" | "in_progress" | "completed" | "failed";
}> {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN success = true THEN 1 END) as completed,
        COUNT(CASE WHEN success = false THEN 1 END) as failed,
        MAX(executed_at) as last_executed
      FROM migration_history
      WHERE version = 'current'
    `);

    const row = result.rows[0];
    const totalSteps = parseInt(row.total);
    const completedSteps = parseInt(row.completed);
    const failedSteps = parseInt(row.failed);
    const lastExecuted = row.last_executed;

    let status: "pending" | "in_progress" | "completed" | "failed";
    if (totalSteps === 0) {
      status = "pending";
    } else if (failedSteps > 0) {
      status = "failed";
    } else if (completedSteps === totalSteps) {
      status = "completed";
    } else {
      status = "in_progress";
    }

    return {
      version: "current",
      totalSteps,
      completedSteps,
      failedSteps,
      lastExecuted,
      status,
    };
  } catch (error) {
    console.error("[MIGRATION] Failed to get status:", error);
    throw error;
  }
}

/**
 * 2단계 마이그레이션: 구필드 제거
 * 1단계: 코드 배포 후 실행
 * 2단계: 안정화 후 실행
 */
export async function executeCleanupMigration(plan: MigrationPlan): Promise<MigrationResult[]> {
  console.log(`[MIGRATION] Starting cleanup migration: ${plan.version}`);

  // 안정화 기간 확인 (최소 24시간)
  const lastMigration = await getMigrationStatus();
  if (lastMigration.lastExecuted) {
    const lastExecuted = new Date(lastMigration.lastExecuted);
    const hoursSinceLastMigration = (Date.now() - lastExecuted.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastMigration < 24) {
      throw new Error(
        `Cleanup migration requires 24 hours stabilization period. Last migration: ${hoursSinceLastMigration.toFixed(1)} hours ago`,
      );
    }
  }

  // 에러율 확인 (5% 미만이어야 함)
  // TODO: 실제 에러율 체크 로직 구현

  return await executeMigrationPlan(plan);
}

/**
 * 마이그레이션 롤백 (전체)
 */
export async function rollbackMigration(version: string): Promise<MigrationResult[]> {
  console.log(`[MIGRATION] Rolling back migration: ${version}`);

  try {
    const result = await pool.query(
      `
      SELECT step_id, step_name, rollback_sql 
      FROM migration_history 
      WHERE version = $1 AND success = true 
      ORDER BY executed_at DESC
    `,
      [version],
    );

    const results: MigrationResult[] = [];

    for (const row of result.rows) {
      const step: MigrationStep = {
        id: row.step_id,
        name: row.step_name,
        sql: "", // 롤백용이므로 빈 문자열
        rollbackSql: row.rollback_sql,
        required: true,
        order: 0,
      };

      const rollbackResult = await rollbackMigrationStep(step);
      results.push(rollbackResult);

      if (!rollbackResult.success) {
        console.error(`[MIGRATION] Rollback failed for step: ${step.name}`);
        // 롤백 실패 시에도 계속 진행 (안전성)
      }
    }

    console.log(`[MIGRATION] Rollback completed: ${version}`);
    return results;
  } catch (error) {
    console.error(`[MIGRATION] Rollback failed: ${version}`, error);
    throw error;
  }
}
