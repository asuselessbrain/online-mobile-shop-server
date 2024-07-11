const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x6ipdw6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri);
async function run() {
  try {
    const usersCollection = client.db("astraGadgets").collection("users");
    const phoneCollection = client.db("astraGadgets").collection("phones");
    // Query for a movie that has the title 'Back to the Future'

    // get latest phone
    app.get("/phones", async (req, res) => {
      const result = await phoneCollection.find().sort({_id: -1}).limit(8).toArray();
      res.send(result)
    });

    // get phone details

    app.get("/phone-details/:id", async(req, res) => {
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await phoneCollection.findOne(query)
      res.send(result)
    })

    // set user in database
    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "User is exist", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
