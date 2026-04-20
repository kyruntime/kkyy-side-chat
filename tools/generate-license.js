#!/usr/bin/env node
/**
 * License Key generator for SideChat Pro.
 *
 * Usage:
 *   node tools/generate-license.js <email> [--exp 2027-12-31]
 *
 * This script uses the PRIVATE key to sign a license payload.
 * Keep this script and the private key SECRET — never ship them with the plugin.
 *
 * The generated key can be sent to the buyer. The plugin verifies it
 * using the embedded PUBLIC key (Ed25519 signature check, fully offline).
 */
const crypto = require("crypto");

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIOE51UQamccJhZ9I2QGBvepiaHc346++rvwqOPW3aPIW
-----END PRIVATE KEY-----`;

function generateLicense(email, options = {}) {
    const payload = {
        email: email,
        plan: options.plan || "pro",
        iat: new Date().toISOString(),
    };
    if (options.exp) {
        payload.exp = new Date(options.exp).toISOString();
    }

    const payloadBuf = Buffer.from(JSON.stringify(payload), "utf-8");
    const payloadB64 = payloadBuf.toString("base64");

    const privKey = crypto.createPrivateKey(PRIVATE_KEY);
    const sigBuf = crypto.sign(null, payloadBuf, privKey);
    const sigB64 = sigBuf.toString("base64");

    return payloadB64 + "." + sigB64;
}

// CLI
const args = process.argv.slice(2);
if (args.length === 0) {
    console.log("Usage: node tools/generate-license.js <email> [--exp YYYY-MM-DD]");
    console.log("");
    console.log("Examples:");
    console.log("  node tools/generate-license.js user@example.com");
    console.log("  node tools/generate-license.js user@example.com --exp 2027-12-31");
    process.exit(1);
}

const email = args[0];
let exp = null;
const expIdx = args.indexOf("--exp");
if (expIdx >= 0 && args[expIdx + 1]) {
    exp = args[expIdx + 1];
}

const key = generateLicense(email, { exp });

console.log("\n=== License Key ===");
console.log(key);
console.log("\n=== Details ===");
console.log("Email:", email);
console.log("Plan: pro");
if (exp) console.log("Expires:", exp);
else console.log("Expires: never");
console.log("\nSend this key to the buyer. They paste it into the SideChat sidebar to activate.\n");
