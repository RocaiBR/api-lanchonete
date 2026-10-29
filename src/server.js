const env = require('./config/env');
const app = require('./app');

app.listen(env.porta, () => {
  console.log(`API da lanchonete rodando em http://localhost:${env.porta}`);
});
