import express from "express";
import ejs     from "ejs"    ;

import filesEJS from "./paths/pathsEJS.mjs";
import client   from "./db/conn_db.mjs"    ;
import utils    from "./paths/utils.mjs"   ;
import env      from './env/load_env.mjs'  ;

import {
  generateSpecsToken,
  scheduleTokenExpiration,
} from "./controlers/controler_token.mjs";

const app  = express();
const PORT = env.PORT ;

const DBNAME_CLUSTER = env.DBNAME_CLUSTER;

app.set("view engine", ejs);

app.use(express.static(utils.viewsPath));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// -----------Conecting to the Database...-----------
let db;
try {
  await client.connect();
  console.log("  ~Connected to MongoDB.~");

  if (DBNAME_CLUSTER) {
    console.log(`  ~Using database: ${DBNAME_CLUSTER}~`);
    db = client.db(DBNAME_CLUSTER);
  } else {
    console.log(`  ~ENV-Error: the database doesn't exist.~`);
    process.exit(1);
  }
} catch (err) {
  console.error(
    "\n  ~An error occurred while connecting to the database.~" +
      `\n    -> ${err.message}`
  );
  process.exit(1);
}
// -----------Conecting to the Database...-----------

// Controler to Generate and Expirate Tokens - BELOW
async function generateToken() {
  const specsToken = generateSpecsToken();

  await db.collection("tokens").insertOne(specsToken);

  scheduleTokenExpiration(specsToken, db);

  return specsToken.token;
}
// Controler to Generate and Expirate Tokens - ABOVE

(async () => {
  // Limpiamos todos los tokens
  db.collection('tokens').deleteMany({});

  // >>-------- GET - Endpoints - Below --------<<
  app.get('/', async (_req, res) => {
    const records = await db.collection('establishments').find({},
      {
        projection: {
          _id: 0,

          shop: 1,
          tag: 1
        }
      }
    ).toArray();

    const data = {
      establishments: records ?? [],
    };

    try {
      res.render(filesEJS.landingEJS, {
        title: 'Beraka',

        data: data,
      });
    } catch (_) {
      res.sendStatus(503);
    }
  });

  app.get('/login-beraka-staff', async (req, res) => {
    const {
      shop, password, tokenExpired, errorFlag, errorMessage
    } = req.query;

    const records = await db.collection('establishments').find({},
      {
        projection: {
          _id: 0,

          shop: 1,
          tag: 1
        }
      }
    ).toArray();

    const data = {
      establishments: records ?? [],

      shop: shop ?? '',
      password: password ?? '',

      tokenExpired: tokenExpired === 'true',

      errorFlag   : errorFlag    === 'true',
      errorMessage: errorMessage ?? '',
    };

    try {
      res.render(filesEJS.loginEJS, {
        title: "Beraka - Staffs",

        data: data,
      });
    } catch (_) {
      res.sendStatus(503);
    }
  });

  app.get('/shop', async (req, res) => {
    const { token, tag } = req.query;

    let subtitle;
    if (!tag) {
      return res.redirect('/');
    } else {
      switch (tag) {
        case 'north':
          subtitle = 'Beraka North';
          break;
        case 'south':
          subtitle = 'Beraka South';
          break;
        default:
          subtitle = 'Beraka';
      }
    }

    const data = {
      products: [],

      token: token,
    };

    if (token) {
      let baseQuery = 'errorFlag=true&';

      const reg_token = await db.collection('tokens').find(
        { token: token },
        {
          projection: {
            _id: 0,
  
            token: 1,
          }
        }
      ).toArray();

      if (token !== reg_token[0].token) {
        baseQuery += 'tokenExpired=true&' +
          `errorMessage=${encodeURIComponent('Token expired')}`;

        return res.redirect(`/login?${baseQuery}`);
      }
    }

    const products = await db.collection('products').find(
      { tag: tag },
      {
        _projection: {
          _id: 0,

          name: 1,
          cost: 1,
          description: 1,
          type: 1,
          img_uri: 1,
          spanish: 1,
        }
      }
    ).toArray();

    data.products = products.reduce((acc,
      { name, cost, description, type, img_uri, spanish }
    ) => {
      if (!acc[type]) {
        acc[type] = [];
      }

      acc[type].push({ name, cost, description, img_uri, spanish });

      return acc;
    }, {});

    try {
      res.render(filesEJS.shopEJS, {
        title: `${subtitle} - Shop`,

        data: data,
      });
    }
    catch (_) { res.sendStatus(503); }
  });

  app.get('/error-at-post', async (_req, res) => {
    try {
      res.render(filesEJS.errorAtPostEJS, {
        title: 'Beraka',
      });
    }
    catch (_) { res.sendStatus(503); }
  });

  app.get('/*', async (_req, res) => {
    try {
      res.render(filesEJS.errorAtGetEJS, {
        title: 'Beraka',
      });
    }
    catch (_) { res.sendStatus(503); }
  });
  // >>-------- GET - Endpoints - Above --------<<

  // >>-------- POST - Endpoints - Below --------<<
  app.post('/test', (_, res) => {
    try       { res.sendStatus(202); }
    catch (_) { res.sendStatus(503); }
  });

  app.post('/login-beraka-staff', async (req, res) => {
    const { tag, password } = req.body;

    if (!tag) {
      return res.status(404).send({ msg: 'Tag not specified.' });
    }
    
    if (!password) {
      return res.status(404).send({ msg: 'Password not specified.' });
    }

    try {
      let baseQuery = 'errorFlag=true&';

      const establishment = await db.collection('establishments').find(
        { tag: tag },
        {
          projection: {
            _id: 0,
            
            shop: 1,
            password: 1,
          }
        }
      ).toArray();

      if (establishment[0].password !== password) {
        baseQuery += `shop=${establishment[0].shop}&` +
          `errorMessage=${encodeURIComponent('Invalid password')}`;
        
        return res.redirect(`/login?${baseQuery}`);
      }

      const token = await generateToken();

      res.redirect(`/shop?token=${token}&tag=${tag}`);
    }
    catch (_) { res.sendStatus(503); }
  });

  app.post('/*', async (_req, res) => {
    try {
      res.redirect('/error-at-post');
    }
    catch (_) { res.sendStatus(503); }
  });
  // >>-------- POST - Endpoints - Above --------<<

  app.listen(PORT, () => {
    console.log(
      `  ~Server listen at port ${PORT}~\n` +
      `  ~[ http://localhost:${PORT} ]~`
    );
  });
})();
