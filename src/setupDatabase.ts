import mongoose from 'mongoose';
import { config } from '@root/config';
import { redisConnection } from '@service/redis/redis.connection';

const log = config.createLogger('setup-database');

export default () => {
  const connect = () => {
    mongoose
      .connect(config.DATABASE_URL!)
      .then(() => {
        log.info('connect to db');
        redisConnection.connect();
      })
      .catch((e) => {
        console.log('connect db error', e);
        return process.exit(1);
      });
  };
  connect();

  mongoose.connection.on('disconnected', connect);
};
