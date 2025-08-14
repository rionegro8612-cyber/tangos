// src/index.ts (확인용)
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';          // helmet v6 기준
import routes from './routes';        // ✅ default import
import requestId from './middlewares/requestId';
import errorHandler from './middlewares/error';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(requestId);

app.use('/api/v1', routes);           // ✅ 여기서만 app.use()

app.get('/health', (req, res) => {
  res.json({ ok: true, requestId: (req as any).requestId });
});

app.use(errorHandler);

app.listen(process.env.PORT || 4000, () => {
  console.log('[server] listening on http://localhost:4000');
});

