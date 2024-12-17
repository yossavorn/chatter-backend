import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';

export class SignOutController {
  public async signout(req: Request, res: Response) {
    req.session = null;
    res.status(HTTP_STATUS.OK).json({ message: 'User logout successfully', user: {}, token: '' });
  }
}
