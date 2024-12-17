import { userService } from '@service/db/user.service';
import { userCache } from '@service/redis/user.cache';
import HTTP_STATUS from 'http-status-codes';
import { Request, Response } from 'express';
import { IUserDocument } from '@user/interfaces/user.interface';

export class GetMeController {
  public async getMeFromCache(req: Request, res: Response) {
    let isUser = false;
    let token = null;
    let user = null;

    const cachedUser: IUserDocument = await userCache.getUserFromCache(`${req.currentUser!.userId}`);
    const existingUser: IUserDocument = cachedUser ? cachedUser : await userService.findOneById(`${req.currentUser!.userId}`);

    //console.log(cachedUser, !existingUser);
    if (Object.keys(existingUser).length) {
      isUser = true;
      token = req.session?.jwt;
      user = existingUser;
    }
    res.status(HTTP_STATUS.OK).json({ token, isUser, user });
  }
}
