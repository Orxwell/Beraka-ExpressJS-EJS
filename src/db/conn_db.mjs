import env from '../env/load_env.mjs';

import { MongoClient, ServerApiVersion } from 'mongodb';

let cacheURI = env.URI_CLUSTER || null;
if (!cacheURI) { process.exit(1); }
cacheURI = cacheURI.replace('<username_cluster>', env.USERNAME_CLUSTER);
cacheURI = cacheURI.replace('<password_cluster>', env.PASSWORD_CLUSTER);

const client = new MongoClient(cacheURI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

export default client;
