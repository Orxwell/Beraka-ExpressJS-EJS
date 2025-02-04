import nodemailer from 'nodemailer';

import env from '../env/env.load.mjs';

const corp_email_user = env.CORP_EMAIL_USER;
const corp_email_key  = env.CORP_EMAIL_KEY ;

if (!corp_email_user) {
  console.error(
    '\n  ~Error:' +
    '\n    La variable de entorno CORP_EMAIL_USER es obligatoria.'
  );
  process.exit(1);
}
  
if (!corp_email_key) {
  console.error(
    '\n  ~Error:' +
    '\n    La variable de entorno CORP_EMAIL_KEY es obligatoria.'
  );
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: corp_email_user,
    pass: corp_email_key,
  },
  tls: { rejectUnauthorized: false }
});

export default transporter;
