import { fileURLToPath }      from 'url' ;
import { dirname, normalize } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename)           ;

const srcPath       = normalize(`${__dirname}/../`)        ;
const viewsPath     = normalize(`${__dirname}/../../views`);
const imgsPath      = normalize(`${viewsPath}/static/img`) ;
const productsPath  = normalize(`${imgsPath}/products`)    ;

const utils = {
  srcPath     : srcPath     ,
  viewsPath   : viewsPath   ,
  imgsPath    : imgsPath    ,
  productsPath: productsPath,
}

export default utils;
