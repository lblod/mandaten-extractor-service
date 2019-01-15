import { query, update, sparqlEscapeUri } from 'mu';

const PREFIXES= `
PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
PREFIX mandaat: <http://data.vlaanderen.be/ns/mandaat#>
PREFIX mu:      <http://mu.semte.ch/vocabularies/core/>
PREFIX org:     <http://www.w3.org/ns/org#>
PREFIX sd:      <http://www.w3.org/ns/sparql-service-description#>
PREFIX nie:     <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX ext:     <http://mu.semte.ch/vocabularies/ext/>
PREFIX void: <http://rdfs.org/ns/void#>
PREFIX pav:  <http://purl.org/pav/>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
`;

async function removeTempGraph(graph) {
  await update(`DROP SILENT GRAPH ${sparqlEscapeUri(graph)}`);
}


async function eenheidForOrgaan(orgaan) {
  const result = await query(`
          ${PREFIXES}
          SELECT DISTINCT ?eenheid ?id WHERE {
             ?eenheid a besluit:Bestuurseenheid;
                      mu:uuid ?id.
             ?orgaan besluit:bestuurt ?eenheid.
             ${sparqlEscapeUri(orgaan)} mandaat:isTijdspecialisatieVan ?orgaan.
          }`);
  if (result.results.bindings.length === 1)
    return {id: result.results.bindings[0].id.value, uri: result.results.bindings[0].eenheid.value};
  else {
    console.log(result.results.bindings);
    throw "expected only one eenheid";
  }
}

export {
  PREFIXES,
  eenheidForOrgaan,
  removeTempGraph
}

