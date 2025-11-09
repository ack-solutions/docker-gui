import bcrypt from "bcryptjs";
import { config, reloadConfig } from "@/server/config";
import UserRepository from "@/server/user/user-repository";
import { rolePermissions } from "@/types/user";
import { initializeDefaultSettings } from "@/server/system/settings-service";
import { prisma } from "@/server/database/client";
import type { SetupStatus, SetupStep } from "@/types/setup";

interface BootstrapInput {
  secret: string;
  email: string;
  password: string;
  name?: string | null;
}

const ensureTrailingSlash = (value: string) => (value.endsWith("/") ? value.slice(0, -1) : value);

class SetupService {
  private static instance: SetupService;

  private readonly repository: UserRepository;
  private backgroundTask: Promise<void> | null = null;
  private lastBackgroundRun: Date | null = null;

  private constructor() {
    this.repository = new UserRepository();
  }

  static getInstance(): SetupService {
    if (!SetupService.instance) {
      SetupService.instance = new SetupService();
    }
    return SetupService.instance;
  }

  async getStatus(): Promise<SetupStatus> {
    const [userCount] = await Promise.all([this.repository.count()]);

    const secretConfigured = this.isSecretConfigured();
    const adminExists = userCount > 0;
    const state: SetupStatus["state"] =
      !adminExists ? "needs-admin" : this.backgroundTask ? "initializing" : "ready";

    const steps: SetupStep[] = [
      {
        id: "secret",
        title: "Set setup.initialSecret",
        description: secretConfigured
          ? "Secret configured. Keep it safe for your records."
          : "Edit config.yml and set setup.initialSecret (minimum 12 characters).",
        completed: secretConfigured
      },
      {
        id: "admin",
        title: "Create the first administrator",
        description: adminExists
          ? "Initial administrator exists. You can now log in."
          : "Use the curl helper with the setup secret to bootstrap the first admin user.",
        completed: adminExists
      },
      {
        id: "configure",
        title: "Finalize configuration",
        description: this.backgroundTask
          ? "Background configuration is still running."
          : "Default settings initialized and configuration cache reloaded.",
        completed: adminExists && !this.backgroundTask
      }
    ];

    const curlExample = this.buildCurlExample(secretConfigured);

    return {
      state,
      secretConfigured,
      adminExists,
      steps,
      curlExample,
      backgroundTask: {
        running: Boolean(this.backgroundTask),
        lastCompletedAt: this.lastBackgroundRun?.toISOString()
      }
    };
  }

  async bootstrapInitialAdmin(input: BootstrapInput): Promise<void> {
    const secret = this.getSetupSecret();
    if (!secret) {
      throw new Error("setup.initialSecret is not configured in config.yml.");
    }

    if (secret !== input.secret?.trim()) {
      throw new Error("Invalid setup secret supplied.");
    }

    if (!input.email || !input.password) {
      throw new Error("Email and password are required.");
    }

    const userCount = await this.repository.count();
    if (userCount > 0) {
      throw new Error("Initial administrator already exists.");
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      throw new Error("A valid email address is required.");
    }

    if (input.password.length < 10) {
      throw new Error("Password must be at least 10 characters long.");
    }

    const passwordHash = bcrypt.hashSync(input.password, config.security.bcryptRounds);

    await this.repository.create({
      email: normalizedEmail,
      passwordHash,
      name: input.name ?? null,
      role: "admin",
      permissions: rolePermissions.admin,
      isSuperAdmin: true
    });

    await this.runBackgroundTasks("bootstrap");
  }

  async ensureBackgroundTasks(reason = "startup"): Promise<void> {
    await this.runBackgroundTasks(reason);
  }

  private isSecretConfigured(): boolean {
    const secret = this.getSetupSecret();
    return Boolean(secret && secret.length >= 12);
  }

  private getSetupSecret(): string | null {
    return (
      config.setup?.initialSecret?.trim() ??
      process.env.SETUP_SECRET?.trim() ??
      null
    );
  }

  private buildCurlExample(secretConfigured: boolean): string {
    const baseUrl = ensureTrailingSlash(
      config.app.baseUrl ?? `http://localhost:${config.app.port ?? 3000}`
    );
    const secretPlaceholder = secretConfigured ? "<setup.initialSecret>" : "REPLACE_WITH_SETUP_INITIALSECRET";

    return [
      `curl -X POST ${baseUrl}/api/setup/bootstrap \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -H "x-setup-secret: ${secretPlaceholder}" \\`,
      `  -d '{`,
      `    "email": "admin@example.com",`,
      `    "password": "ChangeMe123!",`,
      `    "name": "Super Administrator"`,
      `  }'`
    ].join("\n");
  }

  private async runBackgroundTasks(reason: string): Promise<void> {
    if (this.backgroundTask) {
      return this.backgroundTask;
    }

    this.backgroundTask = (async () => {
      try {
        await initializeDefaultSettings();
        await prisma.$queryRaw`PRAGMA optimize`;
        this.lastBackgroundRun = new Date();
      } finally {
        setImmediate(() => {
          try {
            reloadConfig();
          } catch (error) {
            console.error("[setup] Failed to reload configuration after", reason, error);
          }
        });
      }
    })().catch((error) => {
      console.error("[setup] Background tasks failed", error);
      throw error;
    }).finally(() => {
      this.backgroundTask = null;
    });

    await this.backgroundTask;
  }
}

export const setupService = SetupService.getInstance();
export { SetupService };
