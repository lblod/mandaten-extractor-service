import { getDecisions,
         buildTempGraphFromDecision,
         unprocessedDecisionsExist
       } from './support/decision';
import {writeMetaOfDatasetToDatabase, extractMandatenDataset, writeDatasetToFile} from './support/dataset';
import { eenheidForOrgaan, removeTempGraph} from './support/support';
import crypto from 'crypto';
import fs from 'fs';
import { app } from 'mu';

function sha1(string) {
  return crypto.createHash('sha1').update(string).digest('hex');
}

async function processDecisions() {
  for (const decision of await getDecisions()) {
    try {
      const graph = await buildTempGraphFromDecision(decision.content);
      try {
        const mandatenDataset = await extractMandatenDataset(graph);
        const orgaan = decision.orgaan;
        const bestuurseenheid = await eenheidForOrgaan(orgaan);
        if (mandatenDataset !== "") {
          const timestamp= new Date().toISOString().substring(0,19).replace(/[-T:]/g, '');
          const filename = `${timestamp}-g-n-${bestuurseenheid.id}-mandaten-${decision.id}.ttl`;
          const path = await writeDatasetToFile(mandatenDataset, filename);
          await writeMetaOfDatasetToDatabase(decision.uri, bestuurseenheid.uri, path, filename);
        }
        await writeMetaOfDatasetToDatabase(decision.uri, bestuurseenheid.uri);
      }
      finally {
        await removeTempGraph(graph);
      }
    }
    catch(e) {
      console.error(e);
      throw e; //rethrow
    }
  }
}
app.post('/extract-mandaten', async function(req, res, next) {
  try {
    while(await unprocessedDecisionsExist()) {
      await processDecisions();
    }
    res.send({success: true});
  }
  catch(e) {
    console.error(e);
    return next(new Error(e.message));
  }
});
