import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const MAILSERVER_CONTAINER_NAME = "mailserver";

export async function createMailUser(email: string, password: string): Promise<void> {
    try {
        // Check if container is running
        const { stdout: containerCheck } = await execAsync(`docker ps -q -f name=${MAILSERVER_CONTAINER_NAME}`);
        if (!containerCheck.trim()) {
            throw new Error(`Mailserver container '${MAILSERVER_CONTAINER_NAME}' is not running.`);
        }

        // Execute setup command
        // docker exec mailserver setup email add <email> <password>
        await execAsync(`docker exec ${MAILSERVER_CONTAINER_NAME} setup email add ${email} "${password}"`);
        console.log(`Successfully created email account for ${email} on mailserver.`);
    } catch (error: any) {
        console.error("Failed to create mail user:", error);
        // Check for specific error messages if needed, e.g., "Email already exists"
        if (error.message.includes("already exists")) {
            // Maybe we want to update password instead? For now, just re-throw or ignore if acceptable.
            // But 'setup email add' usually fails if exists.
            throw new Error(`Failed to create email account: ${error.message}`);
        }
        throw error;
    }
}

export async function deleteMailUser(email: string): Promise<void> {
    try {
        await execAsync(`docker exec ${MAILSERVER_CONTAINER_NAME} setup email del ${email}`);
    } catch (error: any) {
        console.error("Failed to delete mail user:", error);
        throw error;
    }
}

export async function updateMailUserPassword(email: string, password: string): Promise<void> {
    try {
        await execAsync(`docker exec ${MAILSERVER_CONTAINER_NAME} setup email update ${email} "${password}"`);
    } catch (error: any) {
        console.error("Failed to update mail user password:", error);
        throw error;
    }
}
