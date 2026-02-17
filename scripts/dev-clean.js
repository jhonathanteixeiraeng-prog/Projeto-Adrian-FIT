const fs = require('fs');
const path = require('path');

const devDistDir = path.join(process.cwd(), '.next-dev');

try {
  fs.rmSync(devDistDir, { recursive: true, force: true });
  console.log('[dev-clean] .next-dev limpo');
} catch (error) {
  console.warn('[dev-clean] falha ao limpar .next-dev:', error?.message || error);
}
