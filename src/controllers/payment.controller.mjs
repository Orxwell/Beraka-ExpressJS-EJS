import {
  MercadoPagoConfig,
  Payment
} from 'mercadopago';

import env from '../env/env.load.mjs';

const CALLBACK_URL = `http://localhost:${env.PORT}/payment-done`;
const NOTIFICATION_URL = `http://localhost:${env.PORT}/webhooks/mercadopago`;

let payment;
if (env.MERCADOPAGO_ACCESS_TOKEN) {
  const client = new MercadoPagoConfig({
    accessToken: env.MERCADOPAGO_ACCESS_TOKEN,
    options: { timeout: 5000 }
  });

  payment = new Payment(client);
} else {
  console.error('  ~ENV-Error: MercadoPago Access-Token not found.~');
  process.exit(1);
}

function buildPSEPaymentBody(payment_specs) {
  return {
    transaction_amount: payment_specs.total,
    payment_method_id: 'pse',
    payer: {
      email: payment_specs.email,
      first_name: payment_specs.first_name,
      last_name: payment_specs.last_name,
      identification: {
        type: payment_specs.identification_type,
        number: payment_specs.identification_number,
      },
      phone: {
        area_code: payment_specs.area_code,
        number: payment_specs.phone_number,
      },
      address: {
        zip_code: payment_specs.zip_code,
        street_name: payment_specs.street_name,
        street_number: payment_specs.street_number,
        neighborhood: payment_specs.neighborhood,
        city: payment_specs.city,
      },
      entity_type: payment_specs.entity_type,
    },
    transaction_details: {
      financial_institution: payment_specs.financial_institution,
    },
    additional_info: {
      items: payment_specs.items
    },
    callback_url: CALLBACK_URL,
    notification_url: NOTIFICATION_URL,
    binary_mode: true,
  };
}

function buildCardPaymentBody(payment_specs) {
  return {
    transaction_amount: payment_specs.total,
    payment_method_id: payment_specs.payment_method_id,
    payer: {
      email: payment_specs.email,
      first_name: payment_specs.first_name,
      last_name: payment_specs.last_name,
      identification: {
        type: payment_specs.identification_type,
        number: payment_specs.number,
      },
      phone: {
        area_code: payment_specs.area_code || '57',
        number: payment_specs.phone_number || '0000000000',
      },
      address: {
        zip_code: payment_specs.zip_code           || '000000',
        street_name: payment_specs.street_name     || '',
        street_number: payment_specs.street_number || '',
        neighborhood: payment_specs.neighborhood   || '',
        city: payment_specs.city                   || '',
      },
    },
    card: {
      token: payment_specs.card_token,
    },
    additional_info: {
      items: payment_specs.items
    },
    callback_url: CALLBACK_URL,
    notification_url: NOTIFICATION_URL,
    binary_mode: true,
  };
}

export async function createPayment (payment_specs, db) {
  if (!['nit', 'cc', 'ce'].includes(payment_specs.identification_type)) {
    throw new Error('Invalid payer identification type.');
  }

  let payment_body;
  if (payment_specs.payment_method_id === 'pse') {
    payment_body = buildPSEPaymentBody(payment_specs);
  } else if (['card', 'debit_card', 'credit_card'].includes(payment_specs.payment_method_id)) {
    payment_body = buildCardPaymentBody(payment_specs);
  } else {
    throw new Error('Unsupported payment method.');
  }

  try {
    const register = await db.collection('notifications').insertOne(payment_body);
    payment_body.external_reference = register.insertedId.toString();
  } catch (error) {
    throw new Error('Failed to register payment in the database: ' + error.message);
  }

  console.log(payment_body);

  try           { return await payment.create({ payment_body });  }
  catch (error) { throw new Error('Failed to create a payment.'); }
}
