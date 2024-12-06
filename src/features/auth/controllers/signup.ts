import HTTP_STATUS from 'http-status-codes';
import { validateWithJoiDecorator } from '@global/decorators/joi-validation.decorator';

import { Request, Response } from 'express';

import { signupSchema, SignupSchemaDTO } from '@auth/schemes/signup';
import { authService } from '@service/db/auth.service';

export class SignUpController {
  @validateWithJoiDecorator(signupSchema)
  public async create(req: Request, res: Response) {
    const body: SignupSchemaDTO = req.body;

    const { authData, userJWT } = await authService.signupUser(body);

    req.session = { jwt: userJWT };
    res.status(HTTP_STATUS.CREATED).json({ message: 'User created successfully', authData, token: userJWT });
  }
}
