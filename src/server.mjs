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

// Functions for the endpoints: Recycling - BELOW
const parsingToList = (unparsedString) => {
  return unparsedString?.slice(0, -1)
    .split('-')
    .filter(str => !str.endsWith('_0')) || [];
}

const parsingToDict = (parsedList) => {
  const parsed_dict = {};

  parsedList.forEach(product => {
    const specs = product.split('_');

    const cache = parsed_dict[specs[0]] || 0
    try {
      parsed_dict[specs[0]] = cache + (parseInt(specs[1]) || 0)
    }
    catch (_) {}
  });

  return parsed_dict;
}

const setCounter = (listValues) => {
  let counter = listValues?.reduce((acc, num) => {
    return acc + num;
  }, 0) || 0;

  return counter > 9 ? '9+' : counter;
};

async function verifyOrderProducts (clientOrder) {
  const products_to_verify = Object.keys(clientOrder);
  const found_products = await db.collection('products').find(
    { name: { $in: products_to_verify } },
    { projection: { _id: 1 } }
  ).toArray();

  return products_to_verify.length === found_products.length;
}
// Functions for the endpoints: Recycling - ABOVE

(async () => {
  // Limpiamos todos los tokens
  await db.collection('tokens').deleteMany({});

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
      establishments: records,
    };

    try {
      return res.render(filesEJS.landingEJS, {
        title: 'Beraka',

        data: data,
      });
    } catch (_) { return res.sendStatus(503); }
  });

  app.get('/menu', async (req, res) => {
    const { token, tag, unparsed } = req.query;

    if (!tag) {
      return res.redirect('/');
    }

    let new_unparsed = '';
    let counter      = 0 ;
    if (unparsed) {
      const parsed_list  = parsingToList(unparsed)   ;
      const client_order = parsingToDict(parsed_list);

      if (!verifyOrderProducts(client_order)) {
        return res.redirect('/');
      }

      counter = setCounter(Object.values(client_order));

      new_unparsed = Object.entries(client_order)
        .map(([key, value]) => `${key}_${value}`)
        .join('-') + '-'
    }

    let subtitle;
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

    const data = {
      unparsed: new_unparsed,
      counter: counter,

      products: [],

      token: token,
      tag: tag,
    };

    if (token) {
      let base_query = 'error_flag=true&';

      const reg_token = await db.collection('tokens').find(
        { token: token },
        {
          projection: {
            _id: 0,
  
            token: 1,
          }
        }
      ).toArray();

      if (reg_token.length === 0) {
        base_query += 'token_expired=true&' +
          `error_message=${encodeURIComponent('Token expired')}`;

        return res.redirect(`/login-beraka-staff?${base_query}`);
      }
    }

    const products = await db.collection('products').find(
      { tag: tag },
      {
        projection: {
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

    data.products = products.reduce((acc, product) => {
      const { type, ...details } = product;

      (acc[type] ||= []).push(details);

      return acc;
    }, {});

    try {
      return res.render(filesEJS.menuEJS, {
        title: `${subtitle} - Menu`,

        data: data,
      });
    }
    catch (_) { return res.sendStatus(503); }
  });

  app.get('/ordering', async (req, res) => {
    const { tag, unparsed, product_name, mode } = req.query;

    if (!tag) {
      return res.redirect('/');
    }
    
    if (!product_name) {
      return res.redirect(`/menu?tag=${tag}`);
    }

    if (!mode) {
      return res.redirect(`/menu?tag=${tag}`);
    }

    let new_unparsed = '';
    let counter      = 0 ;
    let quantity     = 1 ;
    if (unparsed) {
      const parsed_list  = parsingToList(unparsed)   ;
      const client_order = parsingToDict(parsed_list);

      if (!verifyOrderProducts(client_order)) {
        return res.redirect('/');
      }

      counter = setCounter(Object.values(client_order));
      if (mode === 'modify') {
        quantity = client_order[product_name];
      }

      new_unparsed = Object.entries(client_order)
        .map(([key, value]) => `${key}_${value}`)
        .join('-') + '-'
    }

    let subtitle;
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

    const product = await db.collection('products').find(
      { name: product_name },
      {
        projection: {
          _id: 0,

          name: 1,
          cost: 1,
          description: 1,
          img_uri: 1,
        }
      }
    ).toArray();

    const data = {
      unparsed: new_unparsed,
      counter: counter,

      product: product[0],
      quantity: quantity,

      tag: tag,
      mode: mode,
    };

    try {
      return res.render(filesEJS.orderingEJS, {
        title: `${subtitle} - Ordering`,

        data: data,
      });
    }
    catch (_) { return res.sendStatus(503); }
  });

  app.get('/shopcart', async (req, res) => {
    const { tag, unparsed, product_name, flag } = req.query;

    if (!tag) {
      return res.redirect('/');
    }

    if (!unparsed) {
      return res.redirect(`/menu?tag=${tag}`);
    }
    
    const parsed_list  = parsingToList(unparsed)   ;
    const client_order = parsingToDict(parsed_list);

    if (flag === 'erase') {
      delete client_order[product_name || ''];
    }

    if (!verifyOrderProducts(client_order)) {
      return res.redirect('/');
    }

    const new_unparsed = Object.entries(client_order)
      .map(([key, value]) => `${key}_${value}`)
      .join('-') + '-';

    let subtitle;
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

    const data = {
      unparsed: new_unparsed,

      ordered: [],
      subtotal: 0,

      tag: tag,
    };

    const ordered = await db.collection('products').find(
      {
        tag: tag,
        name: { $in: Object.keys(client_order) }
      },
      {
        projection: {
          _id: 0,

          name: 1,
          cost: 1,
        }
      }
    ).toArray();

    ordered.forEach(item => {
      const quantity = client_order[item.name];
      item['quantity'] = quantity;

      data.subtotal += quantity * item['cost'];
    });

    data.ordered = ordered;
    data.subtotal = data.subtotal.toLocaleString("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });


    try {
      return res.render(filesEJS.shopcartEJS, {
        title: `${subtitle} - Shopcart`,

        data: data,
      });
    }
    catch (_) { return res.sendStatus(503); }
  });

  app.get('/login-beraka-staff', async (req, res) => {
    const {
      shop, password,
      token_expired, error_flag, error_message
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

      tokenExpired: token_expired === 'true',

      errorFlag   : error_flag    === 'true',
      errorMessage: error_message ?? '',
    };

    try {
      return res.render(filesEJS.loginEJS, {
        title: "Beraka - Staffs",

        data: data,
      });
    } catch (_) { return res.sendStatus(503); }
  });

  app.get('/error-at-post', async (req, res) => {
    try {
      return res.render(filesEJS.errorAtPostEJS, {
        title: 'Beraka - STATUS-INFO',

        route: req.path
      });
    }
    catch (_) { return res.sendStatus(503); }
  });

  app.get('/*', async (req, res) => {
    try {
      return res.render(filesEJS.errorAtGetEJS, {
        title: 'Beraka - STATUS-INFO',

        route: req.path
      });
    }
    catch (_) { return res.sendStatus(503); }
  });
  // >>-------- GET - Endpoints - Above --------<<

  // >>-------- POST - Endpoints - Below --------<<
  app.post('/test', async (_, res) => {
    try       { return res.sendStatus(202); }
    catch (_) { return res.sendStatus(503); }
  });

  app.post('/ordering', async (req, res) => {
    const { tag, unparsed, product_name, quantity, mode } = req.body;

    if (!tag) {
      return res.redirect('/');
    }
    
    if (!product_name) {
      return res.redirect(`/menu?tag=${tag}`);
    }

    if (!quantity) {
      return res.redirect(`/menu?tag=${tag}`);
    }

    if (!mode) {
      return res.redirect(`/menu?tag=${tag}`);
    }

    let new_unparsed = '';
    if (unparsed) {
      const parsed_list = parsingToList(unparsed);
      if (mode === 'add') {
        parsed_list.push(`${product_name}_${quantity}`);
      }

      const client_order = parsingToDict(parsed_list);
      if (!verifyOrderProducts(client_order)) {
        return res.redirect('/');
      }

      if (mode === 'modify') {
        client_order[product_name] = quantity;
      }

      new_unparsed = Object.entries(client_order)
        .map(([key, value]) => `${key}_${value}`)
        .join('-') + '-';

    } else {new_unparsed = `${product_name}_${quantity}-`; }

    try {
      return res.redirect(`/menu?tag=${tag}&unparsed=${new_unparsed}`);
    }
    catch (_) { return res.sendStatus(503); }
  });

  app.post('/checkout', async (req, res) => {
    const { tag, unparsed } = req.body;

    if (!tag) {
      return res.redirect('/');
    }
    
    if (!unparsed) {
      return res.redirect(`/menu?tag=${tag}`);
    }

    try {
      return res.redirect(`/ordering?tag=${tag}&unparsed=${unparsed}`);
    }
    catch (_) { return res.sendStatus(503); }
  });

  app.post('/login-beraka-staff', async (req, res) => {
    const { tag, password } = req.body;

    if (!tag) {
      return res.redirect('/');
    }
    
    if (!password) {
      return res.redirect('/');
    }

    try {
      let base_query = 'error_flag=true&';

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
        base_query += `shop=${establishment[0].shop}&` +
          `error_message=${encodeURIComponent('Invalid password')}`;
        
        return res.redirect(`/login-beraka-staff?${base_query}`);
      }

      const token = await generateToken();

      return res.redirect(`/menu?token=${token}&tag=${tag}`);
    }
    catch (_) { res.sendStatus(503); }
  });

  app.post('/*', async (_req, res) => {
    try       { return res.redirect('/error-at-post'); }
    catch (_) { return res.sendStatus(503);            }
  });
  // >>-------- POST - Endpoints - Above --------<<

  app.listen(PORT, () => {
    console.log(
      `  ~Server listen at port ${PORT}~\n` +
      `  ~[ http://localhost:${PORT} ]~\n`
    );
  });
})();
