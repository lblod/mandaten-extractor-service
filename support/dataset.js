import { uuid, update, sparqlEscapeString, sparqlEscapeDateTime, sparqlEscapeUri } from 'mu';
import fs from 'fs-extra';
import { StringDecoder } from 'string_decoder';
import request from 'request';
import { PREFIXES } from './support';

/**
 * write a dataset to file
 * @method writeDatasetToFile
 * @param {String} mandatenDataset
 * @param {String} filename
 * @return {String} path where the dataset was stored
 */
async function writeDatasetToFile(mandatenDataset, filename) {
  const path = `/share/${filename}`;
  await new Promise(function (resolve, reject) {
    fs.writeFile(path, mandatenDataset, (err) => {
      if (err)
        reject(err);
      else
        resolve();
    });
  });
  return path;
};


/**
 * add some metadata to the database for each created dataset
 * @method writeMetaOfDatasetToDatabase
 * @param {String} decision uri of the decision this dataset was based on.
 * @param {String} bestuurseenheid uri of the eenheid
 * @param {String} path
 * @param {String} filename
 */
async function writeMetaOfDatasetToDatabase(decision, eenheid, path=null, filename=null) {
  const id = uuid();
  await update(`
      ${PREFIXES}
      INSERT DATA {
        GRAPH <http://mu.semte.ch/graphs/mandanten-extractor/> {
             <http://data.lblod.info/datasets/${id}> a void:Dataset, ext:MandatenDataset;
                                                       pav:derivedFrom ${sparqlEscapeUri(decision)};
                                                       mu:uuid ${sparqlEscapeString(id)};
                                                       dcterms:created ${sparqlEscapeDateTime(new Date())};
                                                       dcterms:publisher ${sparqlEscapeUri(eenheid)}.
          }
      }
`);
  if (filename && path) {
    const convertedPath = path.replace(/\/share\//g,'share://');
    await update(`
       ${PREFIXES}
       INSERT DATA {
        GRAPH <http://mu.semte.ch/graphs/mandanten-extractor/> {
             ${sparqlEscapeUri(convertedPath)} a nfo:FileDataObject;
                                               nfo:fileName ${sparqlEscapeString(filename)};
                                               nie:dataSource <http://data.lblod.info/datasets/${id}>.
        }
      }
    `);
  }
  else {
    await update(`
      ${PREFIXES}
      INSERT DATA {
        GRAPH <http://mu.semte.ch/graphs/mandanten-extractor/> {
          <http://data.lblod.info/datasets/${id}> void:triples 0.
        }
      }`);
  }
}

/**
 * executes a construct query and returns the ttl response
 * Note: not compatible with mu-authorization
 * @method turtleQuery
 * @param {String} query the construct query
 * @private
 * @return {Promise} promise will resolve to the turtle response from the database
 */
async function turtleQuery(query) {
  const format = 'text/turtle';
  const options = {
    method: 'POST',
    url: process.env.MU_SPARQL_ENDPOINT,
    headers: {
      'Accept': format
    },
    qs: {
      format: format,
      query: query
    }
  };

  return new Promise ( (resolve,reject) => {
    var text = "";
    var decoder = new StringDecoder('utf8');
    try {
      return request(options)
        .on('error', (error) => { reject(error); })
        .on('data', (chunk) =>
            {
              var textChunk = decoder.write(chunk);
              text = `${text}${textChunk}`;
            }
           )
        .on('end', () => resolve(text));
    }
    catch(e) {
      return reject(e);
    }
  });
}

/**
 * This method will run any construct query in /app/queries on the provided graph.
 * The result of these queries is joined and returned as a string
 *
 * @method extractMandatenDataset
 * @param {String} graph the uri of the graph with the contents of the decision
 * @return {String} turtle the resulting dataset in turtle
 */
async function extractMandatenDataset(graph) {
  var data="";
  for (const queryString of await getQueries()) {
    const executableQuery = queryString.replace(/\$tmpGraph/g,sparqlEscapeUri(graph));
    if (executableQuery.includes(graph)) {
      const r = await turtleQuery(`
       ${PREFIXES}
       ${executableQuery}
    `);
      if (r.match(/# Empty TURTLE/g))
        console.log("no triples returned for query", PREFIXES, executableQuery);
      else
        data=data+"\n"+r;
    }
    else {
      console.warn(`query is missing $tmpGraph`, executableQuery);
    }
  }
  return data;
}

/**
 * gets queries (with extesion .rq) from /app/queries
 * @method getQueries
 * @private
 * @return {Array} an array of query strings
 */
async function getQueries() {
  const queryPath = '/app/queries';
  const items = await fs.readdir(queryPath);
  const queries = [];
  for (const item of items)  {
    if (/.*\.rq$/.test(item)) {
      const query = await fs.readFile(`${queryPath}/${item}`, 'utf8');
      queries.push(query.toString());
    }
  }
  return queries;
}

export {
  extractMandatenDataset,
  writeMetaOfDatasetToDatabase,
  writeDatasetToFile
}
