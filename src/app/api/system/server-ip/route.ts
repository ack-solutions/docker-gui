import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function getPublicIp(): Promise<string | null> {
  try {
    // Try multiple methods to get public IP
    
    // Method 1: Use curl to external service
    try {
      const { stdout } = await execAsync("curl -s ifconfig.me --max-time 3");
      const ip = stdout.trim();
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        return ip;
      }
    } catch (e) {
      // Continue to next method
    }

    // Method 2: Try alternative service
    try {
      const { stdout } = await execAsync("curl -s icanhazip.com --max-time 3");
      const ip = stdout.trim();
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        return ip;
      }
    } catch (e) {
      // Continue to next method
    }

    // Method 3: Try another service
    try {
      const { stdout } = await execAsync("curl -s api.ipify.org --max-time 3");
      const ip = stdout.trim();
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        return ip;
      }
    } catch (e) {
      // Continue to next method
    }

    // Method 4: Try dig
    try {
      const { stdout } = await execAsync("dig +short myip.opendns.com @resolver1.opendns.com");
      const ip = stdout.trim();
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        return ip;
      }
    } catch (e) {
      // All methods failed
    }

    return null;
  } catch (error) {
    console.error("Error getting public IP:", error);
    return null;
  }
}

async function getLocalIp(): Promise<string> {
  try {
    const { stdout } = await execAsync("hostname -I | awk '{print $1}'");
    const ip = stdout.trim();
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      return ip;
    }
  } catch (error) {
    // Fallback
  }
  return "127.0.0.1";
}

export async function GET() {
  try {
    const publicIp = await getPublicIp();
    const localIp = await getLocalIp();

    return NextResponse.json({
      publicIp: publicIp || localIp,
      localIp: localIp,
      hasPublicIp: publicIp !== null,
    });
  } catch (error) {
    console.error("Error fetching server IP:", error);
    return NextResponse.json(
      {
        publicIp: "Unable to determine",
        localIp: "127.0.0.1",
        hasPublicIp: false,
        error: "Failed to determine server IP",
      },
      { status: 500 }
    );
  }
}

