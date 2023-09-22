import {XMLParser} from 'fast-xml-parser';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';

const PARTIAL_NAME = 'ED807';
const BIC_DIRECTORY = 'BICDirectoryEntry';
const ALWAYS_ARRAY = [`${PARTIAL_NAME}.${BIC_DIRECTORY}.Accounts`];
const ATTRIBUTE_PREFIX = 'attr';

const getFile = async () => {
  const response = await fetch('http://www.cbr.ru/s/newbik');

  return response.arrayBuffer();
}

const getXmlFromArchive = async (inMemoryBuffer) => {
 const zip = new AdmZip(inMemoryBuffer);
 const entries = zip.getEntries();

 const entry = entries.reduce((acc, entry) => {
   if (entry.name.includes(PARTIAL_NAME)) {
     Object.assign(acc, entry);
   }

   return acc;
 }, {});

 if (Object.keys(entry).length > 0) {
   return Buffer.from(entry.getData());
 } else {
   return undefined;
 }
}

const prepareData = (rawBic) => {
  return rawBic.map(bicEntry => {
    if (!bicEntry.Accounts) {
      return;
    }

    const decodedName = iconv.decode(bicEntry.ParticipantInfo[`${ATTRIBUTE_PREFIX}NameP`], 'windows-1251');
    const name = iconv.encode(decodedName, 'utf8').toString();
    const bic = bicEntry[`${ATTRIBUTE_PREFIX}BIC`];

    return bicEntry.Accounts.map(bicAccount => {
      return {
        bic,
        name,
        account: bicAccount[`${ATTRIBUTE_PREFIX}Account`],
      }
    });
  }).flat().filter(account => account);
}

const getNewBics = async () => {
  const arrBuffer = await getFile();
  const buffer = Buffer.from(arrBuffer);
  const xmlBuffer = await getXmlFromArchive(buffer);

  if (!xmlBuffer) {
    console.log('no xml');

    return;
  }

  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ATTRIBUTE_PREFIX,
    isArray: (name, jpath) => {
      if(ALWAYS_ARRAY.indexOf(jpath) !== -1) return true;
    }
  });
  const parsedXml = xmlParser.parse(xmlBuffer);

  return prepareData(parsedXml[PARTIAL_NAME][BIC_DIRECTORY]);
}

getNewBics()
  .then(bics => bics)
  .catch(err => console.log(err));
