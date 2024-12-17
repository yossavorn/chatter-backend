import { GetMeController } from '@auth/controllers/current-user';
import { authMiddleware } from '@global/helpers/auth-guard-middleware';

import express, { Router } from 'express';

class CurrentUserRoute {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public getMeRoute(): Router {
    this.router.get('/get-me', authMiddleware.checkAuthentication, GetMeController.prototype.getMeFromCache);

    return this.router;
  }
}

export const currentUserRoute: CurrentUserRoute = new CurrentUserRoute();
