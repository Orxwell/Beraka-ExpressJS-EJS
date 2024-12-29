import env from '../env/load_env.mjs';

import { randomBytes } from 'crypto';

export function generateSpecsToken() {
  const token      = randomBytes(32).toString('base64url');
  const expiration = new Date(
    Date.now() + env.TOKEN_EXPIRATION_SECONDS * 1000
  )

  return { token: token, expiration: expiration }
}

export function scheduleTokenExpiration(specs, db) {
  const expireInMs = specs.expiration - Date.now();

  if (expireInMs > 0) {
    setTimeout(async () => {
      try {
        const foundToken = await db.collection('tokens').findOne(
          { token: specs.token }, { projection: { _id: 1 }}
        );
        if (foundToken) {
          await db.collection('tokens').deleteOne({ token: specs.token });
        }
      } catch (err) {
        console.error(
          '\n  ~An error occurred while expiring a token~' +
          `\n    -> ${err}`
        );
        process.exit(1);
      }
    }, expireInMs);
  }
}