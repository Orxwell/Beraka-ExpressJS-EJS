import { join } from 'path';

import utils from './utils.mjs';

const publicViewsPath  = join(utils.viewsPath, '/public') ;
const privateViewsPath = join(utils.viewsPath, '/private');
const errorsViewsPath  = join(utils.viewsPath, '/errors') ;

// HANDLING ERRORS
const errorAtGetEJS  = join(errorsViewsPath, '/error_at_get.ejs') ;
const errorAtPostEJS = join(errorsViewsPath, '/error_at_post.ejs');

// PRIVATE EJS - STAFFS
const loginEJS       = join(privateViewsPath, '/login.ejs')       ;
const productFormEJS = join(privateViewsPath, '/product_form.ejs');
const ordersEJS      = join(privateViewsPath, '/orders.ejs')      ;

// PUBLIC EJS - CLIENTS
const landingEJS  = join(publicViewsPath, '/landing.ejs') ;
const menuEJS     = join(publicViewsPath, '/menu.ejs')    ;
const orderingEJS = join(publicViewsPath, '/ordering.ejs');
const shopcartEJS = join(publicViewsPath, '/shopcart.ejs');
const checkoutEJS = join(publicViewsPath, '/checkout.ejs');

const filesEJS = {
  errorAtGetEJS,   //*
  errorAtPostEJS,  //*

  loginEJS,       //*
  productFormEJS, //!
  ordersEJS,      //!

  landingEJS,      //*
  menuEJS,         //*
  orderingEJS,     //TODO
  shopcartEJS,     //!
  checkoutEJS,     //!
}
  
export default filesEJS;
