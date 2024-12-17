import { ObjectId } from 'mongodb';
import { AuthModel } from '@auth/models/auth.schema';
import { SignupSchemaDTO } from '@auth/schemes/signup';
import { BadRequestError, NotFoundError, ServerError, UnauthorizedError } from '@global/helpers/error-handler';
import { Helper } from '@global/helpers/helpers';
import { IAuthDocument, ISignUpData } from '@auth/interfaces/auth.interface';
import JWT from 'jsonwebtoken';
import { upload } from '@global/helpers/cloudinary-upload';
import { IUserDocument } from '@user/interfaces/user.interface';
import { userCache } from '@service/redis/user.cache';
import { config } from '@root/config';
import { omit } from 'lodash';
import { authQueue } from '@service/queues/auth.queue';
import { userQueue } from '@service/queues/user.queue';
import { SigninSchemaDTO } from '@auth/schemes/signin';
import { userService } from '@service/db/user.service';
import mongoose from 'mongoose';

class AuthService {
  public async createAuthUser(data: IAuthDocument): Promise<void> {
    await AuthModel.create(data);
  }

  public async getAuthByUsername(username: string): Promise<IAuthDocument> {
    const AuthData = await AuthModel.findOne({ username: Helper.toFirstLetterUpperCase(username) }).exec();

    if (!AuthData) {
      throw new NotFoundError('Cannot find this username');
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
      $or: [{ username: Helper.toFirstLetterUpperCase(username) }, { email: Helper.toLowerCase(email) }]
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
