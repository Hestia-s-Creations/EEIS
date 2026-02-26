const { spawn } = require('child_process');
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * Execute a Python processing script.
 * Passes JSON input via stdin, reads JSON output from stdout.
 * @param {string} scriptName - Name of the Python script (without path)
 * @param {object} input - Input data to pass as JSON
 * @param {object} options - Additional options
 * @returns {Promise<object>} - Parsed JSON output from the script
 */
const executePython = (scriptName, input, options = {}) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, '../../python_processing', scriptName);
    const pythonBin = process.env.PYTHON_BIN || 'python3';
    const timeout = options.timeout || 600000; // 10 minutes default

    logger.info(`Starting Python script: ${scriptName}`);

    const proc = spawn(pythonBin, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1'
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      // Log stderr as it comes in (progress updates)
      const lines = data.toString().trim().split('\n');
      lines.forEach(line => {
        if (line.startsWith('PROGRESS:')) {
          const progress = parseInt(line.replace('PROGRESS:', '').trim());
          if (options.onProgress) options.onProgress(progress);
        } else {
          logger.debug(`Python [${scriptName}]: ${line}`);
        }
      });
    });

    // Set timeout
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Python script ${scriptName} timed out after ${timeout}ms`));
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        logger.error(`Python script ${scriptName} exited with code ${code}: ${stderr}`);
        reject(new Error(`Python script failed (exit code ${code}): ${stderr.slice(-500)}`));
        return;
      }

      try {
        // Try to parse the last JSON object from stdout
        const jsonMatch = stdout.match(/\{[\s\S]*\}(?=[^}]*$)/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          resolve(result);
        } else {
          resolve({ output: stdout.trim(), success: true });
        }
      } catch (parseError) {
        logger.warn(`Could not parse Python output as JSON: ${stdout.slice(-200)}`);
        resolve({ output: stdout.trim(), success: true });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start Python script: ${err.message}`));
    });

    // Send input data as JSON via stdin
    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
};

module.exports = { executePython };
