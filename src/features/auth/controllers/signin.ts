import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { validateWithJoiDecorator } from '@global/decorators/joi-validation.decorator';
import { loginSchema, SigninSchemaDTO } from '@auth/schemes/signin';
import { authService } from '@service/db/auth.service';

export class SigninController {
  @validateWithJoiDecorator(loginSchema)
  public async read(req: Request, res: Response) {
    const body: SigninSchemaDTO = req.body;
    const { userData, userJWT } = await authService.siginUser(body);

    req.session = { jwt: userJWT };
    res.status(HTTP_STATUS.OK).json({ message: 'User login successfully', user: userData, token: userJWT });
  }
}
