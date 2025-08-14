import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { router } from './routes.js';
import { requestId } from './middlewares/requestId.js';
import { errorHandler } from './middlewares/error.js';

const app = express();

app.use(requestId);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/v1', router);

app.use(errorHandler);

app.listen(3000, () => {
  console.log(`API listening on :3000`);
});



