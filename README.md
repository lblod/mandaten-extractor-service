# mandaten extractor service
This service extracts apointed mandates from a legal expression if published according to the oslo application profiles [mandatendatabank](https://data.vlaanderen.be/doc/applicatieprofiel/mandatendatabank/) and [besluit-publicatie](https://data.vlaanderen.be/doc/applicatieprofiel/besluit-publicatie/).

# Usage

docker-compose.yml example
```
version: "3.4"
services:
  mandatenextractor:
    image: lblod/mandaten-extractor-service
    volumes: 
      - ./data/files: /share
    links:
      - virtuoso:database
```


To trigger an extract:
```
curl -XPOST http://mandatenextractor/extract-mandaten
```
