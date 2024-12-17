import Logger from 'bunyan';
import { config } from '@root/config';
import { BaseCache } from '@service/redis/base.cache';
import { IUserDocument } from '@user/interfaces/user.interface';
import { ServerError } from '@global/helpers/error-handler';
import { Helper } from '@global/helpers/helpers';

const log: Logger = config.createLogger('UserCache');

class UserCache extends BaseCache {
  constructor() {
    super('userCache');
  }

  public async saveUserToCache(userID: string, userUId: string, createdUser: IUserDocument): Promise<void> {
    const createdAt = new Date();
    const {
      _id,
      uId,
      username,
      email,
      avatarColor,
      blocked,
      blockedBy,
      postsCount,
      profilePicture,
      followersCount,
      followingCount,
      notifications,
      work,
      location,
      school,
      quote,
      bgImageId,
      bgImageVersion,
      social
    } = createdUser;
    const dataToSave = {
      _id: `${_id}`,
      uId: `${uId}`,
      username: `${username}`,
      email: `${email}`,
      avatarColor: `${avatarColor}`,
      createdAt: `${createdAt}`,
      postsCount: `${postsCount}`,
      blocked: JSON.stringify(blocked),
      blockedBy: JSON.stringify(blockedBy),
      profilePicture: `${profilePicture}`,
      followersCount: `${followersCount}`,
      followingCount: `${followingCount}`,
      notifications: JSON.stringify(notifications),
      social: JSON.stringify(social),
      work: `${work}`,
      location: `${location}`,
      school: `${school}`,
      quote: `${quote}`,
      bgImageVersion: `${bgImageVersion}`,
      bgImageId: `${bgImageId}`
    };

    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      await this.client.ZADD('user', { score: parseInt(userUId, 10), value: `${userID}` });
      for (const [itemKey, itemValue] of Object.entries(dataToSave)) {
        await this.client.HSET(`users:${userID}`, `${itemKey}`, `${itemValue}`);
      }
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }

  public async getUserFromCache(userId: string) {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }

      const response: IUserDocument = (await this.client.HGETALL(`users:${userId}`)) as unknown as IUserDocument;

      response.createdAt = new Date(Helper.parseJson(`${response.createdAt}`));
      response.postsCount = Helper.parseJson(`${response.postsCount}`);
      response.blocked = Helper.parseJson(`${response.blocked}`);
      response.blockedBy = Helper.parseJson(`${response.blockedBy}`);
      response.notifications = Helper.parseJson(`${response.notifications}`);
      response.social = Helper.parseJson(`${response.social}`);
      response.followersCount = Helper.parseJson(`${response.followersCount}`);
      response.followingCount = Helper.parseJson(`${response.followingCount}`);
      response.bgImageId = Helper.parseJson(`${response.bgImageId}`);
      response.bgImageVersion = Helper.parseJson(`${response.bgImageVersion}`);
      response.profilePicture = Helper.parseJson(`${response.profilePicture}`);
      response.work = Helper.parseJson(`${response.work}`);
      response.school = Helper.parseJson(`${response.school}`);
      response.location = Helper.parseJson(`${response.location}`);
      response.quote = Helper.parseJson(`${response.quote}`);

      return response;
    } catch (error) {
      log.error(error);
      throw new ServerError('Server error. Try again.');
    }
  }
}

export const userCache: UserCache = new UserCache();
