import { authRoutes } from '@auth/routes/authRoutes';
import { currentUserRoute } from '@auth/routes/currentUserRoute';
import { authMiddleware } from '@global/helpers/auth-guard-middleware';
import { serverAdapter } from '@service/queues/base.queue';
import { Application } from 'express';

const BASE_PATH = '/api/v1';

export default (app: Application) => {
  const route = () => {
    app.use('/queues', serverAdapter.getRouter());
    app.use(BASE_PATH, authRoutes.unauthenRoute());
    app.use(BASE_PATH, authRoutes.signOutRoute());

    app.use(BASE_PATH, authMiddleware.verifyUser, currentUserRoute.getMeRoute());
  };
  route();
};
