import express from 'express';
import ejs     from 'ejs'    ;

import { randomBytes } from 'crypto';
import {
  MercadoPagoConfig,
  Payment          ,
  Preference
} from 'mercadopago';

import transporter from './controllers/smtp.controller.mjs';
import filesEJS    from './paths/pathsEJS.mjs'             ;
import client      from './db/db.conn.mjs'                 ;
import utils       from './paths/utils.mjs'                ;
import env         from './env/env.load.mjs'               ;
import uploadPNG   from './controllers/img.controller.mjs' ;
import {
  generateSpecsToken     ,
  scheduleTokenExpiration,
} from './controllers/token.controller.mjs';


const PORT   = env.PORT  ;
const DOMAIN = env.DOMAIN;

const DBNAME_CLUSTER = env.DBNAME_CLUSTER;


const app = express();

app.set('view engine', ejs);

app.use(express.static(utils.viewsPath))       ;
app.use(express.urlencoded({ extended: true }));
app.use(express.json())                        ;

// -----------Connecting to the Database - BELOW-----------
let db;
try {
  await client.connect();
  console.log('  ~Connected to MongoDB.~');

  if (DBNAME_CLUSTER) {
    console.log(`  ~Using database: ${DBNAME_CLUSTER}~`);
    db = client.db(DBNAME_CLUSTER);
  } else {
    console.log(`  ~ENV-Error: Database's name not found..~`);
    process.exit(1);
  }
} catch (err) {
  console.error(
    '\n  ~An error occurred while connecting to the database.~' +
    `\n    -> ${err.message}`
  );
  process.exit(1);
}
// -----------Connecting to the Database - ABOVE-----------

// -----------Connecting to MercadoPagoAPI - BELOW-----------
let payment;
let preference;
if (env.MERCADOPAGO_ACCESS_TOKEN) {
  const client = new MercadoPagoConfig({
    accessToken: env.MERCADOPAGO_ACCESS_TOKEN,
    options: { timeout: 5000 }
  });

  payment = new Payment(client);

  preference = new Preference(client);

} else {
  console.error('  ~ENV-Error: MercadoPago Access-Token not found.~');
  process.exit(1);
}
// -----------Connecting to MercadoPagoAPI - ABOVE----------

// Controler to Generate and Expirate Tokens - BELOW
async function generateToken() {
  const specs_token = generateSpecsToken();

  await db.collection('tokens').insertOne(specs_token);

  scheduleTokenExpiration(specs_token, db);

  return specs_token.token;
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
    const { tag, token, unparsed } = req.query;

    if (!tag) {
      return res.redirect('/');
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
        }
      }
    ).toArray();

    let types = await db.collection('types').find({},
      { projection: { _id: 0 } }
    ).toArray();

    types = types.reduce((acc, idiom_type) => {
      const { type, ...idioms } = idiom_type;

      acc[type] = idioms;

      return acc;
    }, {});

    data.products = products.reduce((acc, product) => {
      const { type, ...details } = product;

      details['spanish'] = types[type]['spanish'];

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

  app.get('/checkout', async (req, res) => {
    const { tag, unparsed } = req.query;

    if (!tag) {
      return res.redirect('/');
    }

    if (!unparsed) {
      return res.redirect(`/menu?tag=${tag}`);
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

    const parsed_list  = parsingToList(unparsed)   ;
    const client_order = parsingToDict(parsed_list);

    if (!verifyOrderProducts(client_order)) {
      return res.redirect('/');
    }

    const new_unparsed = Object.entries(client_order)
      .map(([key, value]) => `${key}_${value}`)
      .join('-') + '-';

    const data = {
      unparsed: new_unparsed,

      ordered: [],
      total: 0,

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
          description: 1,
        }
      }
    ).toArray();

    ordered.forEach(item => {
      const quantity = client_order[item.name];
      item['quantity'] = quantity;

      data.total += quantity * item['cost'];
    });

    data.ordered = ordered;

    try {
      return res.render(filesEJS.checkoutEJS, {
        title: `${subtitle} - Checkout`,

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

    const establishments = await db.collection('establishments').find({},
      {
        projection: {
          _id: 0,

          shop: 1,
          tag: 1
        }
      }
    ).toArray();

    const data = {
      establishments: establishments ?? [],

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

  app.get('/product_form', async (req, res) => {
    const { tag, token, product_name, mode } = req.query;

    if (!tag || !mode) {
      return res.redirect('/');
    }

    if (!token) {
      return res.redirect('/login-beraka-staff');
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
      product: undefined,

      tag: tag,
      token: token,
      mode: mode,
    };

    if (product_name) {
      const product = await db.collection('products').find(
        {
          tag: tag,
          name: product_name,
        },
        {
          projection: {
            _id: 0,

            name: 1,
            cost: 1,
            description: 1,
            type: 1,
            img_uri: 1
          }
        }
      ).toArray();

      data.product = product[0];
    }

    try {
      res.render(filesEJS.productFormEJS, {
        title: `${subtitle} - Formulario`,

        data: data,
      });
    }
    catch (_) { res.sendStatus(503); }
  });

  app.get('/mercadopago/payment-success', async (req, res) => { 
    const data = req.query;

    if (!data) {
      return res.status(400).send('No se pudo verificar el pago');
    }

    try {
      const payment_info = await payment.get({ id: data.payment_id });

      if (!payment_info) {
        return res.status(400).send('No se pudo verificar el pago');
      }

      const to_mail = await db.collection('payments').find(
        { external_reference: payment_info.external_reference },
        { projection: { _id: 0, email: 1 }}
      ).toArray();

      console.log(to_mail);

      const mail = {
        from: env.CORP_EMAIL_USER,
        to: to_mail[0].email,
        subject: 'Factura de compra - Productos Beraka',
        text: '¡Muchas gracias por su compra!',
        html: `
          <h1>¡Test!</h1>
          <p>Esto es una prueba...</p>
        `
      }

      transporter.sendMail(mail, (error, info) => {
        if (error) {
          console.log(error);
          return res.sendStatus(503);
        }

        console.log("Correo enviado:", info.response);
      });

      res.status(200).send(`
        <h1>Pago completado</h1>
        <p>Estado del pago: ${data.collection_status}</p>
        <p>Tipo de pago: ${data.payment_type}</p>
        <p>ID del pedido: ${data.external_reference}</p>
      `);
    } catch (error) {
      console.error('Error verificando el pago:', error.message);
      res.status(500).send('Hubo un problema al verificar el pago');
    }
  });

  app.get('/mercadopago/payment-failure', async (req, res) => { 
    const data = req.query;

    if (!data) {
      return res.status(400).send('No se pudo verificar el pago');
    }

    try {
      const payment_info = await payment.get({ id: data.payment_id });

      if (!payment_info) {
        return res.status(400).send('No se pudo verificar el pago');
      }

      const to_mail = await db.collection('payments').find(
        { external_reference: payment_info.external_reference },
        { projection: { _id: 0, email: 1 }}
      ).toArray();

      console.log(to_mail);

      const mail = {
        from: env.CORP_EMAIL_USER,
        to: to_mail[0].email,
        subject: 'Factura de compra - Productos Beraka',
        text: '¡Muchas gracias por su compra!',
        html: `
          <h1>¡Test!</h1>
          <p>Esto es una prueba...</p>
        `
      }

      transporter.sendMail(mail, (error, info) => {
        if (error) {
          console.log(error);
          return res.sendStatus(503);
        }

        console.log("Correo enviado:", info.response);
      });

      res.status(200).send(`
        <h1>Pago completado</h1>
        <p>Estado del pago: ${data.collection_status}</p>
        <p>Tipo de pago: ${data.payment_type}</p>
        <p>ID del pedido: ${data.external_reference}</p>
      `);
    } catch (error) {
      console.error('Error verificando el pago:', error.message);
      res.status(500).send('Hubo un problema al verificar el pago');
    }
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
    const { tag, unparsed, email } = req.body;

    if (!tag) {
      return res.redirect('/');
    }
    
    if (!unparsed) {
      return res.redirect(`/menu?tag=${tag}`);
    }

    if (!email) {
      return res.redirect(`/menu?tag=${tag}`);
    }

    const parsed_list  = parsingToList(unparsed)   ;
    const client_order = parsingToDict(parsed_list);

    if (!verifyOrderProducts(client_order)) {
      return res.redirect('/');
    }

    const ordered = await db.collection('products').find(
      {
        tag: tag,
        name: { $in: Object.keys(client_order) }
      },
      {
        projection: {
          _id: 1,

          name: 1,
          cost: 1,
          description: 1,
          type: 1,
        }
      }
    ).toArray();

    ordered.forEach(item => {
      item['quantity'] = client_order[item.name];
    });

    const items = ordered.map(order => {
      return {
        id: order._id.toString(),
        title: order.name,
        description: order.description,
        category_id: order.type || 'product',
        quantity: order.quantity,
        currency_id: 'COP',
        unit_price: order.cost,
      }
    });
    
    const preference_body = {
      items: items,
      payer: { email: email },

      back_urls: {
        success: `https://${DOMAIN}/mercadopago/payment-success`,
        failure: `https://${DOMAIN}/mercadopago/payment-failure`,
      },

      external_reference: `order-${randomBytes(32).toString('base64url')}`,
      binary_mode: true,
    };

    try {
      const preference_response = await preference.create({ body: preference_body });

      await db.collection('payments').insertOne({
        id                : preference_response.id,
        client_id         : preference_response.client_id,
        collector_id      : preference_response.collector_id,
        items             : preference_response.items,
        email             : preference_response.payer.email,
        external_reference: preference_response.external_reference,
        date_created      : preference_response.date_created,
      });

      return res.redirect(preference_response.sandbox_init_point);

    } catch (error) { return res.sendStatus(503); }
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

  app.post('/product_form', uploadPNG.single('image'), async (req, res) => { 
    const {
      tag, token,
      name, cost, description, type, img_uri,
      mode
    } = req.body;

    if (!tag || !token || !mode) {
      return res.redirect('/');
    }

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

    try {
      let new_img_uri = img_uri;
      if (!req.file) {
        new_img_uri = `/static/img/products/${req.file.originalname}`;
      }
      const filter_config = {
        tag : tag,
        name: name,
      }

      const body_config = {
        name       : name,
        cost       : cost,
        description: description,
        type       : type,
        img_uri    : new_img_uri,
        tag        : tag,
      };

      if (mode === 'add') {
        await db.collection('products').insertOne(body_config);
      
      } else if (mode === 'delete') {
        await db.collection('products').deleteOne(filter_config);

      } else if (mode === 'update') {
        await db.collection('products').updateOne(filter_config,
          { $set: body_config }
        );

      } else { return res.status(400).send('Invalid mode'); }

      return res.redirect(`/menu?tag=${tag}&token=${token}`); 
    }
    catch (_) { return res.sendStatus(503); }
  });

  app.post('/api/webhooks/mercadopago', async (req, res) => {
    const { data, type } = req.body;

    if (!data) {
      return res.status(400).send({ error: 'Invalid request' });
    }

    if (!type) {
      return res.status(400).send({ error: 'Invalid request' });
    }

    try {
      if (type === 'payment') {
        const payment_info = await payment.get({ id: data.id });
        
        if (payment_info.status === 'approved') {
          const verifying_payment = await db.collection('payments').find(
            { external_reference: payment_info.external_reference },
            { projection: { _id:1 } }
          ).toArray();

          if (verifying_payment.length !== 0) {
            return res.status(502).send(false);
          }
        }
      } else {
        console.log('Webhook type not supported');
        return res.status(502).send(false);
      }

      return res.status(200).send(true);
    }
    catch (_) { return res.sendStatus(503); }
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
