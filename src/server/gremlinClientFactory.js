const gremlin = require('gremlin');

function createGremlinClient({ endpoint, primaryKey, database, container }) {
  const authenticator = new gremlin.driver.auth.PlainTextSaslAuthenticator(
    `/dbs/${database}/colls/${container}`,
    primaryKey
  );

  return new gremlin.driver.Client(endpoint, {
    authenticator,
    traversalSource: 'g',
    mimeType: 'application/vnd.gremlin-v2.0+json',
    rejectUnauthorized: true
  });
}

module.exports = {
  createGremlinClient
};
