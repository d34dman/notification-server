#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Generate version information including git commit hash
 */
function generateVersionInfo() {
  try {
    // Read package.json
    const packageJsonPath = path.join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    // Get git commit hash
    let commitHash = "unknown";
    let shortCommitHash = "unknown";
    
    try {
      commitHash = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
      shortCommitHash = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    } catch (error) {
      console.warn("Warning: Could not get git commit hash:", error.message);
    }

    // Get current timestamp
    const buildTime = new Date().toISOString();

    // Create version info object
    const versionInfo = {
      name: packageJson.name,
      version: packageJson.version,
      commitHash: commitHash,
      shortCommitHash: shortCommitHash,
      buildTime: buildTime,
    };

    // Write to src directory so it can be imported
    const outputPath = path.join(__dirname, "..", "src", "version.json");
    fs.writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2));

    console.log(`✅ Version info generated: ${packageJson.name} v${packageJson.version} (${shortCommitHash})`);
    console.log(`📝 Written to: ${outputPath}`);

    return versionInfo;
  } catch (error) {
    console.error("❌ Error generating version info:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateVersionInfo();
}

module.exports = generateVersionInfo;
