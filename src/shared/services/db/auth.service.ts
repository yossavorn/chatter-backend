import { ObjectId } from 'mongodb';
import { AuthModel } from '@auth/models/auth.schema';
import { SignupSchemaDTO } from '@auth/schemes/signup';
import { BadRequestError, NotFoundError, ServerError, UnauthorizedError } from '@global/helpers/error-handler';
import { Helper } from '@global/helpers/helpers';
import { IAuthDocument, ISignUpData } from '@auth/interfaces/auth.interface';
import JWT from 'jsonwebtoken';
import { upload } from '@global/helpers/cloudinary-upload';
import { IResetPasswordParams, IUserDocument } from '@user/interfaces/user.interface';
import { userCache } from '@service/redis/user.cache';
import { config } from '@root/config';
import { omit } from 'lodash';
import { authQueue } from '@service/queues/auth.queue';
import { userQueue } from '@service/queues/user.queue';
import { SigninSchemaDTO } from '@auth/schemes/signin';
import { userService } from '@service/db/user.service';
import mongoose from 'mongoose';
import crypto from 'crypto';

import { emailQueue } from '@service/queues/email.queue';
import { EmailSchemaDTO, PasswordSchemaDTO } from '@auth/schemes/password';
import { forgotPasswordTemplate } from '@service/emails/template/forgot-password/forgot-password';
import moment from 'moment';
import publicIp from 'ip';
import { resetPasswordTemplate } from '@service/emails/template/reset-password/reset-password';

class AuthService {
  public async createAuthUser(data: IAuthDocument): Promise<void> {
    await AuthModel.create(data);
  }

  public async updatePasswordToken(authId: string, token: string, tokenExpiration: number): Promise<void> {
    await AuthModel.updateOne(
      { _id: authId },
      {
        passwordResetToken: token,
        passwordResetExpires: tokenExpiration
      }
    );
  }

  public async getAuthUserByPasswordToken(token: string): Promise<IAuthDocument> {
    const user = await AuthModel.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    }).exec();

    if (!user) {
      throw new NotFoundError('Cannot find Auth User');
    }
    return user;
  }

  public async getAuthByUsername(username: string): Promise<IAuthDocument> {
    const AuthData = await AuthModel.findOne({ username: Helper.toFirstLetterUpperCase(username) }).exec();

    if (!AuthData) {
      throw new NotFoundError('Cannot find this username');
    }
    return AuthData;
  }

  public async getAuthByEmail(email: string): Promise<IAuthDocument> {
    const AuthData = await AuthModel.findOne({ email }).exec();

    if (!AuthData) {
      throw new NotFoundError('Cannot find this email');
    }
    return AuthData;
  }

  public async siginUser(body: SigninSchemaDTO) {
    const { password, username } = body;

    const authData = await this.getAuthByUsername(username);

    const passwordMatch = await authData.comparePassword(password);

    if (!passwordMatch) {
      throw new UnauthorizedError('Invalid password');
    }

    const userData: IUserDocument = await userService.findOneUserByAuthId(`${authData._id}`);

    const userJWT = this.signToken(authData, new mongoose.Types.ObjectId(userData._id));

    return { userData, userJWT };
  }

  public async signupUser(body: SignupSchemaDTO) {
    const { username, email, password, avatarColor, avatarImage } = body;
    //Validate Username or email
    await this.validateExistingUsernameOrEmail(username, email);

    const authObjId = new ObjectId();
    const userObjId = new ObjectId();
    const uId = `${Helper.generateRandomIntegers(12)}`;

    const authData: IAuthDocument = this.signUpData({
      _id: authObjId,
      uId,
      username,
      email,
      password,
      avatarColor
    });

    const result = await upload(avatarImage, `${userObjId}`, true, true);
    if (!result) {
      throw new ServerError('Upload Cloudinary Error');
    }

    if (!result.public_id) {
      throw new BadRequestError('FileUpload: Error');
    }

    //Save to Redis Cache
    const dataToCache: IUserDocument = this.userData(authData, userObjId);
    dataToCache.profilePicture = 'https://res/cloudinary.com/' + config.CLOUD_NAME + `/image/upload/v${result.version}/${userObjId}`;
    await userCache.saveUserToCache(`${userObjId}`, uId, dataToCache);

    //Add to queue
    omit(dataToCache, ['uId', 'username', 'email', 'avatarColor', 'password']);
    authQueue.addAuthUserJob('addAuthUserToDB', { value: authData });
    userQueue.addUserJob('addUserToDB', { value: dataToCache });

    //Add session

    const userJWT: string = this.signToken(authData, userObjId);

    return { authData, userJWT };
  }

  public async resetPassword(body: PasswordSchemaDTO, param: { token: string }) {
    const { password, confirmPassword } = body;
    const { token } = param;

    if (password !== confirmPassword) {
      throw new BadRequestError('Passwords do not match');
    }

    const authData = await this.getAuthUserByPasswordToken(token);

    authData.password = password;
    authData.passwordResetExpires = undefined;
    authData.passwordResetToken = undefined;

    await authData.save();

    const emailTemplateParams: IResetPasswordParams = {
      username: authData.username,
      email: authData.email,
      date: moment().format('DD/MM/YY'),
      ipaddress: publicIp.address()
    };

    const template = resetPasswordTemplate.passwordResetConfirmationTemplate(emailTemplateParams);
    emailQueue.addEmailJob('forgotPassWordEmail', {
      template,
      receiverEmail: authData.email,
      subject: 'Reset your passaword confirmation'
    });
  }

  public async forgotPassword(body: EmailSchemaDTO) {
    const { email } = body;
    const authData = await this.getAuthByEmail(email);

    const randomByte = await Promise.resolve(crypto.randomBytes(20));
    const newToken = randomByte.toString('hex');

    await this.updatePasswordToken(`${authData.id}`, newToken, Date.now() * 60 * 60 * 1000);

    const resetLink = this.genResetPasswordLink(newToken);

    const template = forgotPasswordTemplate.passwordResetTemplate(authData.username, resetLink);

    emailQueue.addEmailJob('forgotPassWordEmail', { template, receiverEmail: email, subject: 'Reset your password' });
  }

  private genResetPasswordLink(token: string): string {
    return `${config.CLIENT_URL}/reset-password?token=${token}`;
  }

  private signToken(data: IAuthDocument, userObjectId: ObjectId): string {
    return JWT.sign(
      {
        userId: userObjectId,
        uId: data.uId,
        email: data.email,
        username: data.username,
        avatarColor: data.avatarColor
      },
      config.JWT_TOKEN!
    );
  }

  private signUpData(data: ISignUpData): IAuthDocument {
    const { _id, uId, username, email, password, avatarColor } = data;
    return {
      _id,
      uId,
      username: Helper.toFirstLetterUpperCase(username),
      email,
      password,
      avatarColor,
      createdAt: new Date()
    } as IAuthDocument;
  }

  private async validateExistingUsernameOrEmail(username: string, email: string) {
    const query = {
      $or: [{ username: Helper.toFirstLetterUpperCase(username) }, { email }]
    };
    const user = await AuthModel.findOne(query).exec();

    if (user) {
      throw new BadRequestError('Duplicate username or id');
    }

    return 'success';
  }

  private userData(data: IAuthDocument, userObjectId: ObjectId): IUserDocument {
    const { _id: authId, username, email, uId, password, avatarColor } = data;
    return {
      _id: userObjectId,
      authId,
      uId,
      username: Helper.toFirstLetterUpperCase(username),
      email,
      password,
      avatarColor,
      profilePicture: '',
      blocked: [],
      blockedBy: [],
      work: '',
      location: '',
      school: '',
      quote: '',
      bgImageVersion: '',
      bgImageId: '',
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      notifications: {
        messages: true,
        reactions: true,
        comments: true,
        follows: true
      },
      social: {
        facebook: '',
        instagram: '',
        twitter: '',
        youtube: ''
      }
    } as unknown as IUserDocument;
  }
}

export const authService = new AuthService();
