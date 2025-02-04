const temp = {
  PORT  : process.env.PORT ?? 5050,
  DOMAIN: process.env.DOMAIN      ,

  DBNAME_CLUSTER  : process.env.DBNAME_CLUSTER?.toLowerCase()       ,
  USERNAME_CLUSTER: encodeURIComponent(process.env.USERNAME_CLUSTER),
  PASSWORD_CLUSTER: encodeURIComponent(process.env.PASSWORD_CLUSTER),
  URI_CLUSTER     : process.env.URI_CLUSTER                         ,

  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN,

  CORP_EMAIL_USER: process.env.CORP_EMAIL_USER,
  CORP_EMAIL_KEY : process.env.CORP_EMAIL_KEY ,

  TOKEN_LIFE_SECONDS: process.env.TOKEN_LIFE_SECONDS ?? 120,
};

const env = {
  PORT  : temp.PORT  ,
  DOMAIN: temp.DOMAIN,

  DBNAME_CLUSTER  : temp.DBNAME_CLUSTER  ,
  USERNAME_CLUSTER: temp.USERNAME_CLUSTER,
  PASSWORD_CLUSTER: temp.PASSWORD_CLUSTER,
  URI_CLUSTER     : temp.URI_CLUSTER     ,

  MERCADOPAGO_ACCESS_TOKEN: temp.MERCADOPAGO_ACCESS_TOKEN,

  CORP_EMAIL_USER: temp.CORP_EMAIL_USER,
  CORP_EMAIL_KEY : temp.CORP_EMAIL_KEY ,

  TOKEN_LIFE_SECONDS: temp.TOKEN_LIFE_SECONDS,
}

export default env;
