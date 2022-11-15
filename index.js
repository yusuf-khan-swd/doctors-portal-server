const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;

const app = express();

app.use(cors()); // use to access server if not then cors error will given
app.use(express.json()); // after getting data as json string convert to js object

app.get('/', (req, res) => {
  res.send("Doctors portal server is running");
});

app.listen(port, () => {
  console.log(`Doctors portal running on port ${port}`);
});