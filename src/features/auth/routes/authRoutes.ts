import { PasswordController } from '@auth/controllers/password';
import { SigninController } from '@auth/controllers/signin';
import { SignOutController } from '@auth/controllers/signout';
import { SignUpController } from '@auth/controllers/signup';
import express, { Router } from 'express';

class AuthRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public unauthenRoute(): Router {
    this.router.post('/signup', SignUpController.prototype.create);
    this.router.post('/signin', SigninController.prototype.read);
    this.router.post('/forgot-password', PasswordController.prototype.forgotPassword);
    this.router.post('/reset-password/:token', PasswordController.prototype.resetPassword);

    return this.router;
  }

  public signOutRoute(): Router {
    this.router.get('/signout', SignOutController.prototype.signout);

    return this.router;
  }
}

export const authRoutes: AuthRoutes = new AuthRoutes();
