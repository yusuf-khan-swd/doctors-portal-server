const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require('jsonwebtoken');
require("dotenv").config();
const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tjl9nwy.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized Access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decode) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden Access' });
    }
    req.decode = decode;
    next();
  })
}

async function run() {
  try {
    const appointmentOptionCollection = client
      .db("doctorsPortal")
      .collection("appointmentOptions");
    const bookingsCollection = client
      .db("doctorsPortal")
      .collection("bookings");
    const usersCollection = client
      .db("doctorsPortal")
      .collection("users");

    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date;
      const query = {};
      const options = await appointmentOptionCollection.find(query).toArray();

      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await bookingsCollection
        .find(bookingQuery)
        .toArray();

      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.treatment === option.name
        );
        const bookedSlots = optionBooked.map((book) => book.slot);
        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots = remainingSlots;
      });

      res.send(options);
    });

    app.get("/v2/appointmentOptions", async (req, res) => {
      const date = req.query.date;
      const options = await appointmentOptionCollection
        .aggregate([
          {
            $lookup: {
              from: "bookings",
              localField: "name",
              foreignField: "treatment",
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$appointmentDate", date],
                    },
                  },
                },
              ],
              as: "booked",
            },
          },
          {
            $project: {
              name: 1,
              slots: 1,
              booked: {
                $map: {
                  input: "$booked",
                  as: "book",
                  in: "$$book.slot",
                },
              },
            },
          },
          {
            $project: {
              name: 1,
              slots: {
                $setDifference: ["$slots", "$booked"],
              },
            },
          },
        ])
        .toArray();

      res.send(options);
    });

    app.get('/bookings', verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodeEmail = req.decode.email;

      if (decodeEmail !== email) {
        return res.status(403).send({ message: 'Forbidden Access' })
      }

      const query = { email: email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;

      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment,
      };
      const alreadyBooked = await bookingsCollection.find(query).toArray();
      if (alreadyBooked.length) {
        const message = `You have already booked the treatment for ${booking.appointmentDate}`;
        return res.send({ acknowledge: false, message });
      }

      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    app.get('/jwt', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: "1d" })
        return res.send({ accessToken: token });
      }

      res.status(403).send({ accessToken: '' });
    });

    app.get('/users', async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

  } finally {
  }
}

run().catch(console.log);

app.get("/", (req, res) => {
  res.send("Doctors portal server is running");
});

app.listen(port, () => {
  console.log(`Doctors portal running on port ${port}`);
});
