import 'dotenv/config';
import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  GeminiRecipeSdkError,
  generateRecipeWithGeminiSdk,
  getGeminiErrorDetails,
} from './src/features/recipes/recipeGeminiClient.ts';

export interface RecipeGeneratorDeps {
  generateFromGemini?: (query: string) => Promise<unknown>;
  lookupVerifiedPhoto?: (englishQuery: string) => Promise<{ imageUrl: string; imageCredit: string } | null>;
}

export function createRecipeApiApp(deps: RecipeGeneratorDeps = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  const requestWindows = new Map<string, { startedAt: number; count: number }>();
  app.use('/api/recipes/generate', (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const current = requestWindows.get(ip);
    if (!current || now - current.startedAt >= 60_000) {
      requestWindows.set(ip, { startedAt: now, count: 1 });
      next();
      return;
    }
    if (current.count >= 20) {
      res.status(429).json({
        error: 'تم تجاوز عدد طلبات الوصفات المسموح مؤقتاً. حاول بعد دقيقة.',
        code: 'RATE_LIMITED',
        retryable: true,
      });
      return;
    }
    current.count += 1;
    next();
  });

  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/recipes/generate', async (req, res) => {
    const rawQuery = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    try {
      const recipe = await generateRecipeWithGeminiSdk(rawQuery, {
        apiKey: (process.env.GEMINI_API_KEY || '').trim(),
        sendUserAgent: true,
        generateFromGemini: deps.generateFromGemini,
        lookupVerifiedPhoto: deps.lookupVerifiedPhoto,
      });
      res.json({ recipe });
    } catch (err) {
      if (err instanceof GeminiRecipeSdkError) {
        res.status(err.status).json({
          error: err.message,
          code: err.code,
          retryable: err.retryable,
        });
        return;
      }
      const mapped = getGeminiErrorDetails(err);
      res.status(mapped.status).json({
        error: mapped.message,
        code: mapped.code,
        retryable: mapped.retryable,
      });
    }
  });

  return app;
}

async function startServer() {
  const app = createRecipeApiApp();
  const port = Number(process.env.PORT) || 3000;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const isProduction = process.env.NODE_ENV === 'production';
  const httpServer = createHttpServer(app);

  if (isProduction) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Tadbeera server listening on http://0.0.0.0:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startServer();
}
