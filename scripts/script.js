// scripts/hash-password.js   (replaces create-user.js)
import readline from "node:readline/promises";
import bcrypt from "bcrypt";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("Shared password (16+ characters, visible as you type): ");
rl.close();
if (password.length < 16) { console.error("Too short"); process.exit(1); }
console.log("\nADMIN_PASSWORD_HASH='" + (await bcrypt.hash(password, 12)) + "'");