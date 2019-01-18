import { uuid, query, update, sparqlEscapeString, sparqlEscapeDateTime, sparqlEscapeUri } from 'mu';
import getRdfaGraph from 'graph-rdfa-processor';
import jsdom from 'jsdom';
import { PREFIXES } from './support';

/**
 * checks if unprocessed decisions exist in the database.
 * @method unprocessedDecisionsExist
 * @return {Boolean}
 */
async function unprocessedDecisionsExist() {
  const r = await( query(`
      ${PREFIXES}
      ASK {
      ?decision a besluit:Besluit;
                mu:uuid ?id.
      ?behandeling a besluit:BehandelingVanAgendapunt;
                   prov:generated ?decision;
                   dcterms:subject ?agendapunt;
                  pav:derivedFrom ?content.
      ?zitting a besluit:Zitting;
               besluit:heeftAgenda/besluit:heeftAgendapunt ?agendapunt;

               besluit:isGehoudenDoor ?orgaan.
      FILTER( NOT EXISTS {
           ?dataset a void:Dataset;
                    a ext:MandatenDataset;
                    pav:derivedFrom ?decision.
      })}`));
  return r.boolean;
}

/**
 * Retrieves 100 decisions from the database. Assumes the html of the linked behandeling is avaible.
 * @method getDecisions
 * @return {Array} an array of decisions, properties: uri, id, content and orgaan
 */
async function getDecisions() {
  const result =  (await query(`
    ${PREFIXES}
    SELECT DISTINCT (?decision as ?uri) ?id ?content ?orgaan
    WHERE {
      ?decision a besluit:Besluit;
                mu:uuid ?id.
      ?behandeling a besluit:BehandelingVanAgendapunt;
                   prov:generated ?decision;
                   dcterms:subject ?agendapunt;
                  pav:derivedFrom ?content.
      ?zitting a besluit:Zitting;
               besluit:heeftAgenda/besluit:heeftAgendapunt ?agendapunt;

               besluit:isGehoudenDoor ?orgaan.
      FILTER( NOT EXISTS {
           ?dataset a void:Dataset;
                    a ext:MandatenDataset;
                    pav:derivedFrom ?decision.
      })
    } ORDER BY ?orgaan LIMIT 100
  `));
  return result.results.bindings.map( (result) => {
    return {
      uri: result.uri.value,
      id: result.id.value,
      content: result.content.value,
      orgaan: result.orgaan.value
    };
  });
}


/**
 * inserts an rdfaGraph into the triple store.
 * Note: doubtfull this will work for large datasets, but should be fine for decisions.
 * @method buildTempGraphFromDecision
 * @param {RdfaGraph} content rdfa content
 * @return {String} uri of the graph that the triples were stored in
 */
async function buildTempGraphFromDecision(content) {
  const graph = graphForDomNode(content);
  removeBlankNodes(graph);
  const tmpGraph = `http://mu.semte.ch/graphs/tmp-mandaten-${uuid()}`;
  await update(`INSERT DATA { GRAPH <${tmpGraph}> { ${graph.toString()} } }`);
  return tmpGraph;
}

/**
 * Returns an RDF graph which contains the RDFa for the supplied Dom Node.
 * Note: imported from notulen-importer and modified, does not use marawa
 * @method graphForContextNode
 *
 * @param {String} html from which the rdfa will be extracted
 * extracted
 * @return {RdfaGraph} Graph with supplied RDFa content
 */
function graphForDomNode(content, baseUri='http://example.org/' ){
  const rdfaPrefixes = {
    eli: "http://data.europa.eu/eli/ontology#",
    prov: "http://www.w3.org/ns/prov#",
    mandaat: "http://data.vlaanderen.be/ns/mandaat#",
    besluit: "http://data.vlaanderen.be/ns/besluit#",
    ext: "http://mu.semte.ch/vocabularies/ext/",
    person: "http://www.w3.org/ns/person#",
    persoon: "http://data.vlaanderen.be/ns/persoon#"
  };
  var prefix = "";
  for ( const key of Object.keys(rdfaPrefixes)) {
    prefix = `${prefix} ${key}: ${rdfaPrefixes[key]}`;
  }
  const dom = new jsdom.JSDOM(`<body>${content}</body>`);
  const topDomNode = dom.window.document.querySelector('body');
  const wrapper = dom.window.document.createElement('div');
  wrapper.appendChild(topDomNode);
  console.log(prefix);
  wrapper.setAttribute( 'prefix', prefix );
  const doc = new dom.window.Document();
  doc.appendChild(wrapper);
  return getRdfaGraph( doc, { baseURI: baseUri } );
}

/**
 * Removes the blank nodes from the supplied RDFa graph
 * Note: imported from notulen importer, unmodified
 * @method removeBlankNodes
 * @param {RdfaGraph} graph Graph from which the blank nodes will be
 * removed.
 * @return {RdfaGraph} Manipulated graph with removed contents
 */
function removeBlankNodes( graph ){
  for( let skey in graph.subjects ){
    const subject = graph.subjects[skey];
    if( skey.indexOf("_:") === 0 ) {
      delete graph.subjects[skey];
    } else {
      for( let pkey in subject.predicates ){
        const predicate = subject.predicates[pkey];
        if( pkey.indexOf("_:") === 0 ) {
          delete subject.predicates[pkey];
        } else {
          let newObjectsArr = [];
          for( let idx = 0 ; idx < predicate.objects.length ; idx++ ) {
            const value = predicate.objects[idx];
            if( value.value.indexOf( "_:" ) === 0 && value.type === "http://www.w3.org/1999/02/22-rdf-syntax-ns#object" ) {
            } else {
              newObjectsArr = [ value , ...newObjectsArr ];
            }
          }
          if( newObjectsArr.length > 0 ){
            newObjectsArr.reverse();
            predicate.objects = newObjectsArr;
          } else {
            delete subject.predicates[pkey];
          }
        }
      }
      if( Object.keys( subject.predicates ).length === 0 ) {
        delete graph.subjects[skey];
      }
    }
  }
  return graph;
}


export {
  getDecisions,
  buildTempGraphFromDecision,
  unprocessedDecisionsExist
};

