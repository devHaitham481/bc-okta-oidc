require('dotenv').config();
const { auth, requiresAuth } = require('express-openid-connect');
const express = require('express');
const app = express();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { ExpressOIDC } = require('@okta/oidc-middleware');

const headers = {
  headers: {
    'X-Auth-Token': process.env.BC_ACCESS_TOKEN,
  },
};

async function getCustomerId(email_address) {
  const url = `https://api.bigcommerce.com/stores/${process.env.BC_STORE_ID}/v3/customers?email:in=${email_address}`;
  const customers = await axios.get(url, headers);

  if (customers.data.data.length > 0) {
    return customers.data.data[0];
  } else {
    return null;
  }
}

async function createCustomer(email_address, given_name, family_name) {
  const new_customer = [
    {
      email: email_address,
      first_name: given_name,
      last_name: family_name,
    },
  ];

  const url = `https://api.bigcommerce.com/stores/${process.env.BC_STORE_ID}/v3/customers`;
  const customers = await axios.post(url, new_customer, headers);
  return customers.data.data[0];
}

async function createToken(customer_id) {
  const dateCreated = Math.round(new Date().getTime() / 1000);
  const payload = {
    iss: process.env.BC_CLIENT_ID,
    iat: dateCreated,
    jti: uuidv4(),
    operation: 'customer_login',
    store_hash: process.env.BC_STORE_ID,
    customer_id: customer_id,
  };
  const token = await jwt.sign(payload, process.env.BC_CLIENT_SECRET, {
    algorithm: 'HS256',
  });
  return token;
}

const oidc = new ExpressOIDC({
  issuer: process.env.ISSUER_BASE_URL,
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.SECRET,
  appBaseUrl: process.env.BASE_URL,
  scope: 'openid profile',
});

app.use(oidc.router);

app.get('/', async (req, res) => {
  //Get the customerId by email address
  let customer_id = await getCustomerId('haitham.maryan@vertrical.com');

  //Create new customer in BC if doesn't already exist
  if (!customer_id) {
    customer_id = await createCustomer(email, 'Haithaam', 'Maryan');
  }

  const token = await createToken(customer_id);

  res.redirect(`${process.env.TARGET_DOMAIN}/login/token/${token}`);
});

app.get('/protected', oidc.ensureAuthenticated(), (req, res) => {
  res.send('Protected stuff');
});

oidc.on('ready', () => {
  app.listen(process.env.PORT || 4000, () => {
    console.log('Started...');
  });
});

oidc.on('error', (err) => {
  console.log('ERROR:' + err);
});
