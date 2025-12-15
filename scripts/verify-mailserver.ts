import { createMailUser } from "../src/server/email/mailserver.utils";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function main() {
    const email = "test-verify@localhost";
    const password = "password123";

    console.log(`Creating account ${email}...`);
    try {
        await createMailUser(email, password);
    } catch (e: any) {
        if (e.message.includes("already exists")) {
            console.log("Account already exists, proceeding to verification.");
        } else {
            throw e;
        }
    }

    console.log("Verifying account existence...");
    const { stdout } = await execAsync("docker exec mailserver setup email list");

    if (stdout.includes(email)) {
        console.log("SUCCESS: Account found in mailserver.");
    } else {
        console.error("FAILURE: Account not found in mailserver.");
        console.error("Output:", stdout);
        process.exit(1);
    }
}

main().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
