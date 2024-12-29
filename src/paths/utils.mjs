import { fileURLToPath }      from 'url' ;
import { dirname, normalize } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename)           ;

const srcPath   = normalize(`${__dirname}/../`);
const viewsPath = normalize(`${__dirname}/../../views`);
const imgsPath  = normalize(`${viewsPath}/static/img`)

const utils = {
  srcPath  : srcPath  ,
  viewsPath: viewsPath,
  imgsPath : imgsPath ,
}

export default utils;
