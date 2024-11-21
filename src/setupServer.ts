import { Application, json, urlencoded, Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import cookieSession from 'cookie-session';
import compression from 'compression';
import HTTP_STATUS from 'http-status-codes';
import { Server } from 'socket.io';
import 'express-async-errors';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { config } from './config';
import appRoute from './routes';
import { CustomError, IErrorResponse } from './shared/globals/helpers/error-handler';

const SERVER_PORT = 5000;
const log = config.createLogger('setup-server');

export class ChatterServer {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  public async start(): Promise<void> {
    this.securityMiddleware(this.app);
    this.standardMiddleware(this.app);
    this.routeMiddleWare(this.app);
    this.globalErrorHandler(this.app);
    await this.startServer(this.app);
  }

  private securityMiddleware(app: Application) {
    app.use(
      cookieSession({
        name: 'session',
        keys: [config.SECRET_KEY_ONE!, config.SECRET_KEY_TWO!],
        maxAge: 24 * 7 * 360000,
        secure: config.NODE_ENV !== 'development'
      })
    );
    app.use(hpp());
    app.use(helmet());
    app.use(
      cors({
        origin: config.CLIENT_URL,
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
      })
    );
  }

  private standardMiddleware(app: Application) {
    app.use(compression());
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ limit: '50mb', extended: true }));
  }

  private routeMiddleWare(app: Application) {
    appRoute(app);
  }

  private globalErrorHandler(app: Application) {
    app.all('*', (req: Request, res: Response) => {
      res.status(HTTP_STATUS.NOT_FOUND).json({ message: `${req.originalUrl} not found` });
    });

    app.use((err: IErrorResponse, _req: Request, res: Response, next: NextFunction): any => {
      log.error(err);
      if (err instanceof CustomError) {
        return res.status(err.statusCode).json(err.serializeError());
      }
      next();
    });
  }

  private async startServer(app: Application): Promise<void> {
    try {
      const httpServer: http.Server = new http.Server(app);
      const socketIO: Server = await this.createSocketIO(httpServer);
      this.startHttpServer(httpServer);
      this.socketIOConnections(socketIO);
    } catch (error) {
      log.error(error);
    }
  }

  private async createSocketIO(httpServer: http.Server) {
    const io: Server = new Server(httpServer, {
      cors: {
        origin: config.CLIENT_URL,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
      }
    });

    const pubClient = createClient({ url: config.REDIS_HOST });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));

    return io;
  }

  private startHttpServer(httpServer: http.Server) {
    log.info(`Server start with process ${process.pid}`);

    httpServer.listen(SERVER_PORT, () => {
      log.info(`Server running on port ${SERVER_PORT}`);
    });
  }

  private socketIOConnections(io: Server) {}
}
