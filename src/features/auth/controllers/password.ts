import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { validateWithJoiDecorator } from '@global/decorators/joi-validation.decorator';

import { authService } from '@service/db/auth.service';
import { emailSchema, EmailSchemaDTO, passwordSchema, PasswordSchemaDTO } from '@auth/schemes/password';

export class PasswordController {
  @validateWithJoiDecorator(emailSchema)
  public async forgotPassword(req: Request, res: Response) {
    const body: EmailSchemaDTO = req.body;
    await authService.forgotPassword(body);

    res.status(HTTP_STATUS.OK).json({ message: 'Forgot Password Email Sent', token: null, isUser: false, user: null });
  }
  @validateWithJoiDecorator(passwordSchema)
  public async resetPassword(req: Request<{ token: string }>, res: Response) {
    const body: PasswordSchemaDTO = req.body;
    const param = req.params;
    await authService.resetPassword(body, param);
    res.status(HTTP_STATUS.OK).json({ message: 'Reset Password Email Sent' });
  }
}
