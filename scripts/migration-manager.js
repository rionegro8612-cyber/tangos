#!/usr/bin/env node

/**
 * 마이그레이션 운영 규칙 관리 스크립트
 * "스키마 추가 → 코드 배포 → 구필드 제거(2단계)" 프로세스 자동화
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

// 환경변수 로드
require("dotenv").config();

class MigrationManager {
  constructor() {
    this.client = null;
    this.migrationsDir = path.resolve(__dirname, "../migrations");
    this.migrationLogFile = path.resolve(__dirname, "../migration-log.json");
  }

  async connect() {
    const { DATABASE_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSLMODE } = process.env;
    
    let connectionString = DATABASE_URL;
    if (!connectionString) {
      if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER) {
        throw new Error("DATABASE_URL or DB_* environment variables are required");
      }
      connectionString = `postgres://${DB_USER}:${DB_PASSWORD || ""}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=${DB_SSLMODE || "disable"}`;
    }

    this.client = new Client({ connectionString });
    await this.client.connect();
    console.log("✅ Database connected");
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      console.log("✅ Database disconnected");
    }
  }

  loadMigrationLog() {
    try {
      if (fs.existsSync(this.migrationLogFile)) {
        return JSON.parse(fs.readFileSync(this.migrationLogFile, "utf8"));
      }
    } catch (error) {
      console.warn("⚠️ Could not load migration log:", error.message);
    }
    return { migrations: [], currentStage: "none" };
  }

  saveMigrationLog(log) {
    try {
      fs.writeFileSync(this.migrationLogFile, JSON.stringify(log, null, 2));
    } catch (error) {
      console.error("❌ Failed to save migration log:", error.message);
    }
  }

  async getMigrationFiles() {
    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => /_up\.sql$/i.test(f))
      .sort((a, b) => a.localeCompare(b));
    
    return files.map(file => ({
      name: file,
      path: path.join(this.migrationsDir, file),
      stage: this.determineMigrationStage(file)
    }));
  }

  determineMigrationStage(filename) {
    // 파일명 패턴으로 마이그레이션 단계 판단
    if (filename.includes("add_") || filename.includes("create_")) {
      return "schema_add";
    } else if (filename.includes("remove_") || filename.includes("drop_")) {
      return "field_remove";
    } else {
      return "schema_modify";
    }
  }

  async executeMigration(filePath, stage) {
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`\n▶ Executing ${path.basename(filePath)} (${stage})...`);
    
    try {
      await this.client.query("BEGIN");
      await this.client.query(sql);
      await this.client.query("COMMIT");
      console.log("✅ Migration successful");
      return true;
    } catch (error) {
      await this.client.query("ROLLBACK");
      console.error(`❌ Migration failed: ${error.message}`);
      return false;
    }
  }

  async runStage1_SchemaAdd() {
    console.log("\n🚀 Stage 1: Schema Addition");
    console.log("================================");
    
    const log = this.loadMigrationLog();
    const files = await this.getMigrationFiles();
    
    const schemaAddFiles = files.filter(f => f.stage === "schema_add");
    
    if (schemaAddFiles.length === 0) {
      console.log("ℹ️ No schema addition migrations found");
      return true;
    }

    for (const file of schemaAddFiles) {
      const success = await this.executeMigration(file.path, file.stage);
      if (!success) {
        console.error("❌ Stage 1 failed. Stopping migration process.");
        return false;
      }
      
      // 마이그레이션 로그 업데이트
      log.migrations.push({
        file: file.name,
        stage: file.stage,
        executedAt: new Date().toISOString(),
        status: "success"
      });
      this.saveMigrationLog(log);
    }
    
    log.currentStage = "schema_add_completed";
    this.saveMigrationLog(log);
    
    console.log("✅ Stage 1 completed. Ready for code deployment.");
    console.log("📋 Next step: Deploy your application code, then run Stage 2.");
    return true;
  }

  async runStage2_FieldRemoval() {
    console.log("\n🚀 Stage 2: Field Removal (After Code Deployment)");
    console.log("==================================================");
    
    const log = this.loadMigrationLog();
    
    if (log.currentStage !== "schema_add_completed") {
      console.error("❌ Stage 1 must be completed before Stage 2");
      console.log("💡 Run Stage 1 first, then deploy your code");
      return false;
    }
    
    const files = await this.getMigrationFiles();
    const fieldRemoveFiles = files.filter(f => f.stage === "field_remove");
    
    if (fieldRemoveFiles.length === 0) {
      console.log("ℹ️ No field removal migrations found");
      log.currentStage = "completed";
      this.saveMigrationLog(log);
      return true;
    }

    console.log("⚠️ WARNING: This will remove database fields/columns!");
    console.log("📋 Make sure your application code is deployed and tested.");
    
    for (const file of fieldRemoveFiles) {
      const success = await this.executeMigration(file.path, file.stage);
      if (!success) {
        console.error("❌ Stage 2 failed. Manual intervention may be required.");
        return false;
      }
      
      log.migrations.push({
        file: file.name,
        stage: file.stage,
        executedAt: new Date().toISOString(),
        status: "success"
      });
      this.saveMigrationLog(log);
    }
    
    log.currentStage = "completed";
    this.saveMigrationLog(log);
    
    console.log("✅ Stage 2 completed. Migration process finished.");
    return true;
  }

  async rollback(stage) {
    console.log(`\n🔄 Rolling back to stage: ${stage}`);
    console.log("=====================================");
    
    const log = this.loadMigrationLog();
    const files = await this.getMigrationFiles();
    
    // 롤백할 마이그레이션 파일들 찾기
    let rollbackFiles = [];
    if (stage === "before_schema_add") {
      rollbackFiles = files.filter(f => f.stage === "schema_add");
    } else if (stage === "before_field_removal") {
      rollbackFiles = files.filter(f => f.stage === "field_remove");
    }
    
    if (rollbackFiles.length === 0) {
      console.log("ℹ️ No migrations to rollback for this stage");
      return true;
    }
    
    // 롤백 실행 (down 스크립트 사용)
    for (const file of rollbackFiles.reverse()) {
      const downFile = file.path.replace("_up.sql", "_down.sql");
      
      if (fs.existsSync(downFile)) {
        console.log(`\n▶ Rolling back ${path.basename(file.name)}...`);
        const success = await this.executeMigration(downFile, "rollback");
        if (!success) {
          console.error("❌ Rollback failed");
          return false;
        }
      } else {
        console.warn(`⚠️ No down script found for ${file.name}`);
      }
    }
    
    console.log("✅ Rollback completed");
    return true;
  }

  async showStatus() {
    const log = this.loadMigrationLog();
    const files = await this.getMigrationFiles();
    
    console.log("\n📊 Migration Status");
    console.log("===================");
    console.log(`Current Stage: ${log.currentStage}`);
    console.log(`Total Migrations: ${files.length}`);
    console.log(`Executed: ${log.migrations.length}`);
    
    console.log("\n📁 Migration Files:");
    files.forEach(file => {
      const executed = log.migrations.some(m => m.file === file.name);
      const status = executed ? "✅" : "⏳";
      console.log(`  ${status} ${file.name} (${file.stage})`);
    });
    
    if (log.migrations.length > 0) {
      console.log("\n📝 Execution Log:");
      log.migrations.forEach(m => {
        console.log(`  ${m.executedAt} - ${m.file} (${m.stage})`);
      });
    }
  }
}

// CLI 인터페이스
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const manager = new MigrationManager();
  
  try {
    await manager.connect();
    
    switch (command) {
      case "stage1":
        await manager.runStage1_SchemaAdd();
        break;
      case "stage2":
        await manager.runStage2_FieldRemoval();
        break;
      case "rollback":
        const stage = args[1] || "before_schema_add";
        await manager.rollback(stage);
        break;
      case "status":
        await manager.showStatus();
        break;
      case "help":
      default:
        console.log(`
🔄 Migration Manager - 2단계 마이그레이션 프로세스

Usage:
  node migration-manager.js <command> [options]

Commands:
  stage1     - Stage 1: 스키마 추가 (코드 배포 전)
  stage2     - Stage 2: 구필드 제거 (코드 배포 후)
  rollback   - 롤백 실행 (stage: before_schema_add, before_field_removal)
  status     - 현재 상태 확인
  help       - 도움말 표시

Process Flow:
  1. stage1: 스키마 추가 마이그레이션 실행
  2. 코드 배포 및 테스트
  3. stage2: 구필드 제거 마이그레이션 실행

Example:
  node migration-manager.js stage1
  # 코드 배포 후
  node migration-manager.js stage2
        `);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await manager.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = MigrationManager;
