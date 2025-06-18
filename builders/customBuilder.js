import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import LogHelper from "../helpers/LogHelper.js";
import config from '../app.config.js';

let logger = new LogHelper();

logger.info2('Building custom utilities started');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

for (const relPath of config.additionalBuilders) {
    const fullPath = path.resolve(__dirname, `..${relPath}`);
    
    if (fs.existsSync(fullPath)) {
      await import(fullPath);
    } else {
      logger.warn(`Builder not found at path: ${relPath}, skipping the builder.`);
    }
  }

