import { randomBytes } from 'crypto';

import env from '../env/env.load.mjs';

export function generateSpecsToken() {
  const token      = randomBytes(32).toString('base64url');
  const expiration = new Date(
    Date.now() + env.TOKEN_LIFE_SECONDS * 1000
  );

  return { token: token, expiration: expiration }
}

export function scheduleTokenExpiration(specs, db) {
  const expire_in_ms = specs.expiration - Date.now();

  if (expire_in_ms > 0) {
    setTimeout(async () => {
      try {
        const found_token = await db.collection('tokens').findOne(
          { token: specs.token }, { projection: { _id: 1 }}
        );
        if (found_token) {
          await db.collection('tokens').deleteOne({ token: specs.token });
        }
      } catch (err) {
        console.error(
          '\n  ~An error occurred while expiring a token~' +
          `\n    -> ${err}`
        );
        process.exit(1);
      }
    }, expire_in_ms);
  }
}