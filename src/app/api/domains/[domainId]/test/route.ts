import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import https from "https";
import http from "http";

const execAsync = promisify(exec);

interface TestResult {
  dns: {
    status: "pass" | "fail" | "pending";
    message: string;
    resolvedIp?: string;
  };
  http: {
    status: "pass" | "fail" | "not-tested";
    message: string;
    statusCode?: number;
  };
  https: {
    status: "pass" | "fail" | "not-tested";
    message: string;
    statusCode?: number;
    sslValid?: boolean;
  };
  nginx: {
    status: "pass" | "fail";
    message: string;
  };
}

async function testDnsResolution(domain: string): Promise<TestResult["dns"]> {
  try {
    const { stdout } = await execAsync(`dig +short ${domain} A`);
    const ips = stdout
      .trim()
      .split("\n")
      .filter((line) => line.match(/^\d+\.\d+\.\d+\.\d+$/));

    if (ips.length > 0) {
      return {
        status: "pass",
        message: `DNS resolves correctly to ${ips.length} IP(s)`,
        resolvedIp: ips[0],
      };
    } else {
      return {
        status: "fail",
        message: "Domain does not resolve to any IP address",
      };
    }
  } catch (error) {
    return {
      status: "fail",
      message: `DNS lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function testHttpConnectivity(domain: string): Promise<TestResult["http"]> {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: domain,
        port: 80,
        path: "/",
        timeout: 5000,
      },
      (res) => {
        resolve({
          status: "pass",
          message: `HTTP connection successful`,
          statusCode: res.statusCode,
        });
      }
    );

    req.on("error", (error) => {
      resolve({
        status: "fail",
        message: `HTTP connection failed: ${error.message}`,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        status: "fail",
        message: "HTTP connection timed out",
      });
    });
  });
}

async function testHttpsConnectivity(domain: string): Promise<TestResult["https"]> {
  return new Promise((resolve) => {
    const req = https.get(
      {
        hostname: domain,
        port: 443,
        path: "/",
        timeout: 5000,
        rejectUnauthorized: false, // We'll check SSL separately
      },
      (res) => {
        const cert = (res.socket as any).getPeerCertificate();
        const sslValid = cert && !cert.subject ? false : true;

        resolve({
          status: "pass",
          message: `HTTPS connection successful`,
          statusCode: res.statusCode,
          sslValid,
        });
      }
    );

    req.on("error", (error) => {
      if (error.message.includes("ECONNREFUSED")) {
        resolve({
          status: "fail",
          message: "HTTPS not configured (port 443 not responding)",
        });
      } else {
        resolve({
          status: "fail",
          message: `HTTPS connection failed: ${error.message}`,
        });
      }
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        status: "fail",
        message: "HTTPS connection timed out",
      });
    });
  });
}

async function testNginxConfig(domainId: string): Promise<TestResult["nginx"]> {
  try {
    // Check if nginx config exists for this domain
    const { stdout, stderr } = await execAsync(
      `docker exec nginx-proxy test -f /etc/nginx/sites-enabled/${domainId}.conf && echo "exists" || echo "missing"`
    );

    if (stdout.trim() === "exists") {
      // Test nginx configuration
      const { stderr: testStderr } = await execAsync(
        `docker exec nginx-proxy nginx -t 2>&1`
      );

      if (testStderr.includes("successful")) {
        return {
          status: "pass",
          message: "Nginx configuration is valid",
        };
      } else {
        return {
          status: "fail",
          message: "Nginx configuration has errors",
        };
      }
    } else {
      return {
        status: "fail",
        message: "Nginx configuration file not found",
      };
    }
  } catch (error) {
    return {
      status: "fail",
      message: `Nginx check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { domainId: string } }
) {
  try {
    const { domainId } = params;

    // TODO: Get domain from database to get the actual domain name
    // For now, we'll use a placeholder
    // const domain = await getDomainById(domainId);
    const domain = { name: "example.com" }; // Placeholder

    // Run all tests in parallel
    const [dnsResult, httpResult, httpsResult, nginxResult] = await Promise.all([
      testDnsResolution(domain.name),
      testHttpConnectivity(domain.name),
      testHttpsConnectivity(domain.name),
      testNginxConfig(domainId),
    ]);

    const results: TestResult = {
      dns: dnsResult,
      http: httpResult,
      https: httpsResult,
      nginx: nginxResult,
    };

    return NextResponse.json(results);
  } catch (error) {
    console.error("Domain test error:", error);
    return NextResponse.json(
      { error: "Failed to test domain" },
      { status: 500 }
    );
  }
}

