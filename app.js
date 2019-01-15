import { getDecisions,
         buildTempGraphFromDecision
       } from './support/decision';
import {writeMetaOfDatasetToDatabase, extractMandatenDataset, writeDatasetToFile} from './support/dataset';
import { eenheidForOrgaan, removeTempGraph} from './support/support';
import crypto from 'crypto';
import fs from 'fs';
import { app } from 'mu';

function sha1(string) {
  return crypto.createHash('sha1').update(string).digest('hex');
}

app.post('/extract-mandaten', async function(req, res, next) {
  try {
    for (const decision of await getDecisions()) {
      try {
        const graph = await buildTempGraphFromDecision(decision.content);
        try {
          const mandatenDataset = await extractMandatenDataset(graph);
          const orgaan = decision.orgaan;
          const bestuurseenheid = await eenheidForOrgaan(orgaan);
          const timestamp=new Date();
          const filename = `${bestuurseenheid.id}-mandaten-from-${decision.id}-${timestamp.toISOString().substring(0,10)}.ttl`;
          const path = await writeDatasetToFile(mandatenDataset, filename);
          await writeMetaOfDatasetToDatabase(path, filename, decision.uri);
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
    res.send({success: true});
  }
  catch(e) {
    console.error(e);
    return next(new Error(e.message));
  }
});
