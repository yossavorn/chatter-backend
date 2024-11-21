import express, { Express } from 'express';
import { ChatterServer } from './setupServer';
import dbConnection from './setupDatabase';
import { config } from './config';

class Application {
  public initialize(): void {
    this.loadConfig();
    dbConnection();
    const app: Express = express();
    const server: ChatterServer = new ChatterServer(app);
    server.start();
  }

  private loadConfig(): void {
    config.validateConfig();
  }
}

const application: Application = new Application();

application.initialize();
