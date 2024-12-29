import { join } from 'path';

import utils from './utils.mjs';

const publicViewsPath  = join(utils.viewsPath, '/public') ;
const privateViewsPath = join(utils.viewsPath, '/private');
const errorsViewsPath  = join(utils.viewsPath, '/errors') ;

// PUBLIC EJS - CLIENTS
const landingEJS = join(publicViewsPath, '/landing.ejs');
const shopEJS    = join(publicViewsPath, '/shop.ejs')   ; // CLIENTS & STAFFS
const orderEJS   = join(publicViewsPath, '/order.ejs')  ;
const checkEJS   = join(publicViewsPath, '/check.ejs')  ;

// PRIVATE EJS - STAFFS
const loginEJS        = join(privateViewsPath, '/login.ejs')       ;
const productFormEJS  = join(privateViewsPath, '/product_form.ejs');
const notificationEJS = join(privateViewsPath, '/notification.ejs');

// HANDLING ERRORS
const errorAtPostEJS = join(errorsViewsPath, '/error_at_post.ejs');
const errorAtGetEJS  = join(errorsViewsPath, '/error_at_get.ejs') ;

const filesEJS = {
  landingEJS,      //*
  shopEJS,         //TODO
  orderEJS,        //!
  checkEJS,        //!

  loginEJS,        //*
  productFormEJS,  //!
  notificationEJS, //!

  errorAtGetEJS,   //*
  errorAtPostEJS,  //*
}
  
export default filesEJS;
