/**
 * Load environment variables from .env files for Deno tests
 * Supports .env.local, .env, and .env.test files
 */

async function loadEnvFile(filePath: string): Promise<void> {
  try {
    const content = await Deno.readTextFile(filePath);
    const lines = content.split("\n");

    for (const line of lines) {
      // Skip empty lines and comments
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Parse KEY=VALUE format
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        // Only set if not already in environment
        if (!Deno.env.get(key)) {
          Deno.env.set(key, value);
        }
      }
    }
  } catch (error) {
    // File doesn't exist, that's okay
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    throw error;
  }
}

/**
 * Load environment variables from .env files
 * Checks in order: .env.local, .env.test, .env
 */
export async function loadEnv(): Promise<void> {
  const envFiles = [".env.local", ".env.test", ".env"];

  for (const file of envFiles) {
    try {
      await loadEnvFile(file);
    } catch (error) {
      // Silently skip if file doesn't exist
      if (error instanceof Deno.errors.NotFound) {
        continue;
      }
      console.warn(`Warning: Failed to load ${file}:`, error);
    }
  }
}
