const express = require('express');

const config = require('./config');

const attachRoutes = require('./src/routes');

const app = express();

app.use(express.static('public', {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['html', 'js', 'css'],
  index: false,
  redirect: false,
}));

app.use(express.json())

app.use('/', (req, res) => res.redirect(301, '/upload'))

attachRoutes(app);

app.listen(config.app.port, () => console.log(`Server can be reached at http://localhost:${config.app.port}`));