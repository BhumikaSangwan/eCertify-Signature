import { Redis } from 'ioredis';

const redisInstance = new Redis({
    password: process.env.REDIS_PASSWORD,
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null
})

export default redisInstance;