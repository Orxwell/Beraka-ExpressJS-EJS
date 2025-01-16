const temp = {
  PORT: process.env.PORT ?? 5050,

  DBNAME_CLUSTER  : process.env.DBNAME_CLUSTER?.toLowerCase(),
  USERNAME_CLUSTER: encodeURIComponent(process.env.USERNAME_CLUSTER),
  PASSWORD_CLUSTER: encodeURIComponent(process.env.PASSWORD_CLUSTER),
  URI_CLUSTER     : process.env.URI_CLUSTER,

  TOKEN_LIFE_SECONDS: process.env.TOKEN_LIFE_SECONDS ?? 120,
};

const env = {
  PORT: temp.PORT,

  DBNAME_CLUSTER  : temp.DBNAME_CLUSTER,
  USERNAME_CLUSTER: temp.USERNAME_CLUSTER,
  PASSWORD_CLUSTER: temp.PASSWORD_CLUSTER,
  URI_CLUSTER     : temp.URI_CLUSTER,

  TOKEN_LIFE_SECONDS: temp.TOKEN_LIFE_SECONDS,
}

export default env;
