#!/usr/bin/env node

/**
 * 헬스체크 및 에러율 모니터링 스크립트
 * 롤백 기준: 에러율 5% 이상
 */

const http = require("http");
const https = require("https");

class HealthChecker {
  constructor(config = {}) {
    this.config = {
      appUrl: config.appUrl || process.env.APP_URL || "http://localhost:3000",
      healthEndpoint: config.healthEndpoint || "/health",
      metricsEndpoint: config.metricsEndpoint || "/health/metrics",
      errorThreshold: config.errorThreshold || 0.05, // 5%
      checkInterval: config.checkInterval || 30000, // 30초
      maxFailures: config.maxFailures || 3,
      ...config
    };
    
    this.failureCount = 0;
    this.lastCheck = null;
    this.isHealthy = true;
  }

  async checkHealth() {
    try {
      console.log(`🔍 Checking health at: ${this.config.appUrl}${this.config.healthEndpoint}`);
      
      const healthResponse = await this.makeRequest(`${this.config.appUrl}${this.config.healthEndpoint}`);
      
      if (healthResponse.status !== 200) {
        throw new Error(`Health check failed with status: ${healthResponse.status}`);
      }
      
      console.log("✅ Health check passed");
      this.failureCount = 0;
      this.isHealthy = true;
      
      // 메트릭 확인
      await this.checkMetrics();
      
    } catch (error) {
      console.error(`❌ Health check failed: ${error.message}`);
      this.failureCount++;
      this.isHealthy = false;
      
      if (this.failureCount >= this.config.maxFailures) {
        console.error(`🚨 Health check failed ${this.failureCount} times. System may be unhealthy.`);
        await this.triggerRollback();
      }
    }
    
    this.lastCheck = new Date();
  }

  async checkMetrics() {
    try {
      console.log(`📊 Checking metrics at: ${this.config.appUrl}${this.config.metricsEndpoint}`);
      
      const metricsResponse = await this.makeRequest(`${this.config.appUrl}${this.config.metricsEndpoint}`);
      
      if (metricsResponse.status !== 200) {
        console.warn(`⚠️ Metrics endpoint returned status: ${metricsResponse.status}`);
        return;
      }
      
      const metrics = JSON.parse(metricsResponse.body);
      await this.analyzeMetrics(metrics);
      
    } catch (error) {
      console.warn(`⚠️ Metrics check failed: ${error.message}`);
    }
  }

  async analyzeMetrics(metrics) {
    const errorRate = this.calculateErrorRate(metrics);
    console.log(`📈 Current error rate: ${(errorRate * 100).toFixed(2)}%`);
    
    if (errorRate > this.config.errorThreshold) {
      console.error(`🚨 Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${(this.config.errorThreshold * 100).toFixed(2)}%`);
      await this.triggerRollback();
    } else {
      console.log(`✅ Error rate is within acceptable range`);
    }
    
    // 추가 메트릭 분석
    this.analyzeAdditionalMetrics(metrics);
  }

  calculateErrorRate(metrics) {
    // 다양한 메트릭 형식 지원
    if (metrics.error_rate !== undefined) {
      return metrics.error_rate;
    }
    
    if (metrics.errors && metrics.requests) {
      return metrics.errors / metrics.requests;
    }
    
    if (metrics.http_errors && metrics.http_requests) {
      return metrics.http_errors / metrics.http_requests;
    }
    
    if (metrics.failed_requests && metrics.total_requests) {
      return metrics.failed_requests / metrics.total_requests;
    }
    
    // 기본값: 에러율을 알 수 없음
    console.warn("⚠️ Could not determine error rate from metrics");
    return 0;
  }

  analyzeAdditionalMetrics(metrics) {
    // CPU 사용률 체크
    if (metrics.cpu_usage !== undefined) {
      const cpuUsage = metrics.cpu_usage;
      if (cpuUsage > 80) {
        console.warn(`⚠️ High CPU usage: ${cpuUsage}%`);
      }
    }
    
    // 메모리 사용률 체크
    if (metrics.memory_usage !== undefined) {
      const memoryUsage = metrics.memory_usage;
      if (memoryUsage > 85) {
        console.warn(`⚠️ High memory usage: ${memoryUsage}%`);
      }
    }
    
    // 응답 시간 체크
    if (metrics.response_time !== undefined) {
      const responseTime = metrics.response_time;
      if (responseTime > 1000) {
        console.warn(`⚠️ High response time: ${responseTime}ms`);
      }
    }
    
    // 데이터베이스 연결 체크
    if (metrics.db_connections !== undefined) {
      const dbConnections = metrics.db_connections;
      if (dbConnections.active > dbConnections.max * 0.8) {
        console.warn(`⚠️ High database connection usage: ${dbConnections.active}/${dbConnections.max}`);
      }
    }
  }

  async triggerRollback() {
    console.log("🔄 Triggering rollback due to health check failure...");
    
    try {
      // 롤백 스크립트 실행
      const { exec } = require("child_process");
      const rollbackCommand = "node scripts/migration-manager.js rollback before_schema_add";
      
      exec(rollbackCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ Rollback failed: ${error.message}`);
          return;
        }
        
        if (stderr) {
          console.warn(`⚠️ Rollback warnings: ${stderr}`);
        }
        
        console.log(`✅ Rollback output: ${stdout}`);
        console.log("🔄 Rollback completed");
      });
      
    } catch (error) {
      console.error(`❌ Failed to trigger rollback: ${error.message}`);
    }
  }

  makeRequest(url) {
    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith("https://");
      const client = isHttps ? https : http;
      
      const req = client.get(url, { timeout: 10000 }, (res) => {
        let body = "";
        
        res.on("data", (chunk) => {
          body += chunk;
        });
        
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });
      
      req.on("error", (error) => {
        reject(error);
      });
      
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
    });
  }

  startMonitoring() {
    console.log(`🚀 Starting health monitoring for: ${this.config.appUrl}`);
    console.log(`📊 Check interval: ${this.config.checkInterval / 1000} seconds`);
    console.log(`🚨 Error threshold: ${(this.config.errorThreshold * 100).toFixed(2)}%`);
    console.log(`⏹️ Max failures: ${this.config.maxFailures}`);
    
    // 즉시 첫 번째 체크 실행
    this.checkHealth();
    
    // 주기적 체크 설정
    this.interval = setInterval(() => {
      this.checkHealth();
    }, this.config.checkInterval);
  }

  stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log("⏹️ Health monitoring stopped");
    }
  }

  getStatus() {
    return {
      isHealthy: this.isHealthy,
      failureCount: this.failureCount,
      lastCheck: this.lastCheck,
      config: this.config
    };
  }
}

// CLI 인터페이스
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const config = {
    appUrl: process.env.APP_URL || "http://localhost:3000",
    healthEndpoint: process.env.HEALTH_ENDPOINT || "/health",
    metricsEndpoint: process.env.METRICS_ENDPOINT || "/health/metrics",
    errorThreshold: parseFloat(process.env.ERROR_THRESHOLD) || 0.05,
    checkInterval: parseInt(process.env.CHECK_INTERVAL) || 30000,
    maxFailures: parseInt(process.env.MAX_FAILURES) || 3
  };
  
  const healthChecker = new HealthChecker(config);
  
  switch (command) {
    case "start":
      healthChecker.startMonitoring();
      
      // 프로세스 종료 시그널 처리
      process.on("SIGINT", () => {
        console.log("\n🛑 Received SIGINT, stopping health monitoring...");
        healthChecker.stopMonitoring();
        process.exit(0);
      });
      
      process.on("SIGTERM", () => {
        console.log("\n🛑 Received SIGTERM, stopping health monitoring...");
        healthChecker.stopMonitoring();
        process.exit(0);
      });
      break;
      
    case "check":
      await healthChecker.checkHealth();
      break;
      
    case "status":
      const status = healthChecker.getStatus();
      console.log("📊 Health Checker Status:");
      console.log(JSON.stringify(status, null, 2));
      break;
      
    case "help":
    default:
      console.log(`
🏥 Health Checker - 애플리케이션 상태 모니터링

Usage:
  node health-check.js <command>

Commands:
  start   - 헬스체크 모니터링 시작 (지속적)
  check   - 단일 헬스체크 실행
  status  - 현재 상태 확인
  help    - 도움말 표시

Environment Variables:
  APP_URL              - 애플리케이션 URL (기본값: http://localhost:3000)
  HEALTH_ENDPOINT      - 헬스체크 엔드포인트 (기본값: /health)
  METRICS_ENDPOINT     - 메트릭 엔드포인트 (기본값: /health/metrics)
  ERROR_THRESHOLD      - 에러율 임계치 (기본값: 0.05 = 5%)
  CHECK_INTERVAL       - 체크 간격 (밀리초, 기본값: 30000 = 30초)
  MAX_FAILURES         - 최대 실패 횟수 (기본값: 3)

Example:
  node health-check.js start
  node health-check.js check
        `);
  }
}

if (require.main === module) {
  main();
}

module.exports = HealthChecker;
